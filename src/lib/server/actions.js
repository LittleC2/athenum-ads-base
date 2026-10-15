// Fila de ações. Toda escrita na Meta passa por aqui: o copiloto PROPÕE, o
// gestor APROVA, e só então a ação roda (e fica no registro de auditoria).
import { db } from './db.js';
import { audit } from './audit.js';
import { metaWritesDisabled } from './settings.js';
import { withAccountToken } from './meta/client.js';
import { activateDraft, setDailyBudget, setStatus, uploadDraft } from './meta/builder.js';
import { SpecSchema, totalDailyBudgetCents } from '../campaignSpec.js';
import { brl } from '../format.js';

export const ACTION_TYPES = {
	UPLOAD_DRAFT: 'Enviar campanha para a Meta (pausada)',
	ACTIVATE_DRAFT: 'Ativar campanha (gasta dinheiro)',
	PAUSE_ENTITY: 'Pausar',
	ACTIVATE_ENTITY: 'Ativar (gasta dinheiro)',
	CHANGE_BUDGET: 'Mudar orçamento diário'
};

/** Ações que ligam ou aumentam gasto exigem confirmação explícita extra na tela. */
export const SPENDS_MONEY = new Set(['ACTIVATE_DRAFT', 'ACTIVATE_ENTITY', 'CHANGE_BUDGET']);

async function entityOfAccount(accountId, entityId) {
	const entity = await db.metaEntity.findFirst({ where: { accountId, externalId: entityId } });
	if (!entity) throw new Error('Esse item não pertence à conta (ou ainda não foi sincronizado).');
	return entity;
}

/** Valida a proposta antes de gravar, pra não criar na fila algo que nunca poderia rodar. */
async function validateProposal({ type, accountId, payload }) {
	const account = accountId ? await db.adAccount.findUnique({ where: { id: accountId } }) : null;
	if (type === 'UPLOAD_DRAFT' || type === 'ACTIVATE_DRAFT') {
		const draft = await db.campaignDraft.findUnique({ where: { id: payload.draftId } });
		if (!draft) throw new Error('Rascunho não encontrado.');
		if (type === 'ACTIVATE_DRAFT' && draft.status !== 'UPLOADED')
			throw new Error('Só dá para ativar um rascunho já enviado e sem falhas.');
		return { accountId: draft.accountId, clientId: draft.clientId };
	}
	if (!account) throw new Error('Conta não informada.');
	await entityOfAccount(account.id, payload.entityId);
	if (type === 'CHANGE_BUDGET') {
		const cents = Number(payload.newDailyBudgetCents);
		if (!Number.isInteger(cents) || cents < 600)
			throw new Error('Orçamento diário inválido (mínimo R$ 6,00).');
		if (account.maxDailyBudgetCents && cents > account.maxDailyBudgetCents) {
			throw new Error(
				`Passa do teto de segurança da conta (${brl(account.maxDailyBudgetCents)} por dia).`
			);
		}
	}
	return { accountId: account.id, clientId: account.clientId };
}

/**
 * Cria uma ação. `source` COPILOT fica PENDING (precisa de aprovação);
 * MANUAL já nasce aprovada porque o próprio gestor clicou.
 */
export async function proposeAction({ type, summary, payload, source, userId }) {
	if (!ACTION_TYPES[type]) throw new Error(`Tipo de ação desconhecido: ${type}`);
	const scope = await validateProposal({ type, accountId: payload.accountId, payload });
	return db.proposedAction.create({
		data: {
			type,
			summary,
			payload,
			source,
			status: source === 'MANUAL' ? 'APPROVED' : 'PENDING',
			clientId: scope.clientId,
			accountId: scope.accountId,
			createdById: userId ?? null,
			decidedById: source === 'MANUAL' ? userId : null,
			decidedAt: source === 'MANUAL' ? new Date() : null
		}
	});
}

async function run(action) {
	const { type, payload } = action;
	if (await metaWritesDisabled()) throw new Error('A escrita na Meta está bloqueada nos Ajustes.');

	if (type === 'UPLOAD_DRAFT') return uploadDraft(payload.draftId);

	if (type === 'ACTIVATE_DRAFT') {
		const draft = await db.campaignDraft.findUnique({
			where: { id: payload.draftId },
			include: { account: true }
		});
		const total = totalDailyBudgetCents(SpecSchema.parse(draft.spec));
		if (draft.account.maxDailyBudgetCents && total > draft.account.maxDailyBudgetCents) {
			throw new Error(
				`Orçamento diário ${brl(total)} passa do teto da conta (${brl(draft.account.maxDailyBudgetCents)}).`
			);
		}
		await activateDraft(payload.draftId);
		return { activated: true };
	}

	const account = await db.adAccount.findUnique({ where: { id: action.accountId } });
	return withAccountToken(account, () => runEntityAction(action));
}

async function runEntityAction(action) {
	const { type, payload } = action;
	const entity = await entityOfAccount(action.accountId, payload.entityId);
	if (type === 'PAUSE_ENTITY') {
		await setStatus(entity.externalId, 'PAUSED');
		await db.metaEntity.update({
			where: { id: entity.id },
			data: { status: 'PAUSED', effectiveStatus: 'PAUSED' }
		});
		return { paused: entity.name };
	}
	if (type === 'ACTIVATE_ENTITY') {
		await setStatus(entity.externalId, 'ACTIVE');
		await db.metaEntity.update({
			where: { id: entity.id },
			data: { status: 'ACTIVE', effectiveStatus: 'ACTIVE' }
		});
		return { activated: entity.name };
	}
	if (type === 'CHANGE_BUDGET') {
		await setDailyBudget(entity.externalId, Number(payload.newDailyBudgetCents));
		await db.metaEntity.update({
			where: { id: entity.id },
			data: { dailyBudgetCents: Number(payload.newDailyBudgetCents) }
		});
		return { newDailyBudgetCents: Number(payload.newDailyBudgetCents) };
	}
	throw new Error(`Tipo de ação sem executor: ${type}`);
}

/** Executa uma ação já aprovada (ou aprova e executa). Garante que roda uma vez só. */
export async function executeAction(actionId, adminId) {
	const claimed = await db.proposedAction.updateMany({
		where: { id: actionId, status: { in: ['PENDING', 'APPROVED'] } },
		data: { status: 'APPROVED', decidedById: adminId, decidedAt: new Date() }
	});
	if (!claimed.count) throw new Error('Essa ação já foi executada ou rejeitada.');

	const action = await db.proposedAction.findUnique({ where: { id: actionId } });
	try {
		const result = await run(action);
		await db.proposedAction.update({
			where: { id: actionId },
			data: { status: 'EXECUTED', result: result ?? {}, error: null }
		});
		await audit({
			userId: adminId,
			clientId: action.clientId,
			accountId: action.accountId,
			action: `meta.${action.type}`,
			target: action.summary,
			payload: { source: action.source, result }
		});
		return result;
	} catch (err) {
		await db.proposedAction.update({
			where: { id: actionId },
			data: { status: 'FAILED', error: String(err.message).slice(0, 500) }
		});
		await audit({
			userId: adminId,
			clientId: action.clientId,
			accountId: action.accountId,
			action: `meta.${action.type}`,
			target: action.summary,
			ok: false,
			error: err.message
		});
		throw err;
	}
}

export async function rejectAction(actionId, adminId) {
	const r = await db.proposedAction.updateMany({
		where: { id: actionId, status: 'PENDING' },
		data: { status: 'REJECTED', decidedById: adminId, decidedAt: new Date() }
	});
	if (!r.count) throw new Error('Essa ação não está mais pendente.');
	await audit({ userId: adminId, action: 'action.reject', target: actionId });
}
