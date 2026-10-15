import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';
import { executeAction, proposeAction } from '$lib/server/actions.js';
import { setStatus, validateDraftOnMeta } from '$lib/server/meta/builder.js';
import { withAccountToken } from '$lib/server/meta/client.js';
import { emptySpec, SpecSchema, totalDailyBudgetCents } from '$lib/campaignSpec.js';

const EDITABLE = ['DRAFT', 'REVIEW', 'FAILED'];

async function findDraft(id) {
	const draft = await db.campaignDraft.findUnique({
		where: { id },
		include: { account: true, client: { select: { name: true } } }
	});
	if (!draft) throw error(404, 'Campanha não encontrada.');
	return draft;
}

export const load = async ({ params, locals }) => {
	requireAdmin(locals);
	const draft = await findDraft(params.id);
	const parsed = SpecSchema.safeParse(draft.spec);
	const spec = parsed.success ? parsed.data : emptySpec(draft.objective, draft.name);
	const [assets, copies] = await Promise.all([
		db.asset.findMany({
			where: { clientId: draft.clientId },
			orderBy: { createdAt: 'desc' },
			select: { id: true, name: true, kind: true }
		}),
		db.copyVariant.findMany({
			where: { clientId: draft.clientId, status: 'APPROVED' },
			orderBy: { createdAt: 'desc' },
			take: 40
		})
	]);
	return {
		draft: {
			id: draft.id,
			name: draft.name,
			objective: draft.objective,
			status: draft.status,
			clientName: draft.client.name,
			plannerNotes: draft.plannerNotes,
			lastError: draft.lastError,
			metaCampaignId: draft.metaCampaignId,
			metaState: draft.metaState,
			editable:
				EDITABLE.includes(draft.status) && (!draft.metaCampaignId || draft.status === 'FAILED')
		},
		account: {
			id: draft.account.id,
			externalId: draft.account.externalId,
			name: draft.account.name,
			pageId: draft.account.pageId,
			maxDailyBudgetCents: draft.account.maxDailyBudgetCents
		},
		spec,
		assets,
		copies: copies.map((c) => ({
			id: c.id,
			angle: c.angle,
			primaryText: c.primaryText,
			headline: c.headline,
			description: c.description ?? ''
		}))
	};
};

export const actions = {
	salvar: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		const draft = await findDraft(params.id);
		if (draft.metaCampaignId && draft.status !== 'FAILED')
			return fail(400, {
				error: 'Esta campanha já foi enviada à Meta e não pode mais ser editada aqui.'
			});
		let raw;
		try {
			raw = JSON.parse(String((await request.formData()).get('spec') ?? ''));
		} catch {
			return fail(400, { error: 'Não consegui ler os dados do formulário.' });
		}
		const parsed = SpecSchema.safeParse(raw);
		if (!parsed.success)
			return fail(400, { error: `Dados inválidos: ${parsed.error.issues[0]?.message}` });
		await db.campaignDraft.update({
			where: { id: params.id },
			data: {
				spec: parsed.data,
				name: parsed.data.campaignName,
				status: draft.status === 'FAILED' ? 'DRAFT' : draft.status,
				lastError: null
			}
		});
		await audit({
			userId: admin.id,
			clientId: draft.clientId,
			accountId: draft.accountId,
			action: 'draft.update',
			target: draft.name
		});
		return { ok: 'Rascunho salvo.' };
	},

	validarMeta: async ({ params, locals }) => {
		requireAdmin(locals);
		await findDraft(params.id);
		try {
			return { validation: await validateDraftOnMeta(params.id) };
		} catch (err) {
			return fail(502, { error: `Falha ao validar na Meta: ${err.message}` });
		}
	},

	enviar: async ({ params, locals }) => {
		const admin = requireAdmin(locals);
		const draft = await findDraft(params.id);
		try {
			const action = await proposeAction({
				type: 'UPLOAD_DRAFT',
				summary: `Enviar "${draft.name}" para a Meta (pausada)`,
				payload: { draftId: draft.id },
				source: 'MANUAL',
				userId: admin.id
			});
			const result = await executeAction(action.id, admin.id);
			return {
				ok: result.failedAds
					? `Enviada com ${result.failedAds} anúncio(s) com falha. Veja abaixo e reenvie.`
					: 'Enviada para a Meta, tudo pausado.'
			};
		} catch (err) {
			return fail(502, { error: err.message });
		}
	},

	ativar: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		const draft = await findDraft(params.id);
		if ((await request.formData()).get('confirm') !== 'on') {
			return fail(400, { error: 'Marque a confirmação de gasto para ativar.' });
		}
		const total = totalDailyBudgetCents(SpecSchema.parse(draft.spec));
		try {
			const action = await proposeAction({
				type: 'ACTIVATE_DRAFT',
				summary: `Ativar "${draft.name}" (até ${(total / 100).toFixed(2).replace('.', ',')} por dia)`,
				payload: { draftId: draft.id },
				source: 'MANUAL',
				userId: admin.id
			});
			await executeAction(action.id, admin.id);
			return {
				ok: 'Campanha ativada. Acompanhe a revisão da Meta na tela de Alertas e no painel.'
			};
		} catch (err) {
			return fail(502, { error: err.message });
		}
	},

	pausar: async ({ params, locals }) => {
		const admin = requireAdmin(locals);
		const draft = await findDraft(params.id);
		if (!draft.metaCampaignId) return fail(400, { error: 'Esta campanha ainda não está na Meta.' });
		try {
			// Pausar só reduz gasto, então vale mesmo com a trava de escrita ligada.
			await withAccountToken(draft.account, () => setStatus(draft.metaCampaignId, 'PAUSED'));
		} catch (err) {
			return fail(502, { error: `Falha ao pausar: ${err.message}` });
		}
		await db.campaignDraft.update({ where: { id: draft.id }, data: { status: 'UPLOADED' } });
		await audit({
			userId: admin.id,
			clientId: draft.clientId,
			accountId: draft.accountId,
			action: 'meta.PAUSE_CAMPAIGN',
			target: draft.name
		});
		return { ok: 'Campanha pausada na Meta.' };
	},

	excluir: async ({ params, locals }) => {
		const admin = requireAdmin(locals);
		const draft = await findDraft(params.id);
		if (draft.metaCampaignId)
			return fail(400, {
				error: 'Já existe na Meta. Pause por aqui e arquive no Gerenciador de Anúncios.'
			});
		await db.campaignDraft.delete({ where: { id: draft.id } });
		await audit({
			userId: admin.id,
			clientId: draft.clientId,
			action: 'draft.delete',
			target: draft.name
		});
		throw redirect(303, '/admin/campanhas');
	}
};
