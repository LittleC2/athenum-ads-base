// Testa a fila de ações (guardas e execução) na Meta de verdade, SÓ na conta
// pessoal do gestor, com uma campanha pausada criada e apagada pelo teste.
// Uso: npx vite-node --config vitest.config.js scripts/actions-live-test.js
import { requireEnv } from './_env.js';
import { db } from '../src/lib/server/db.js';
import { graph } from '../src/lib/server/meta/client.js';
import { SpecSchema } from '../src/lib/campaignSpec.js';
import { createCampaign, setStatus } from '../src/lib/server/meta/builder.js';
import { syncEntities } from '../src/lib/server/meta/entities.js';
import { executeAction, proposeAction } from '../src/lib/server/actions.js';
import { setSetting } from '../src/lib/server/settings.js';

const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${extra ? ' | ' + extra : ''}`);
};
const rejects = async (fn) => {
	try {
		await fn();
		return null;
	} catch (e) {
		return e.message;
	}
};

const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
const client = await db.client.create({
	data: { slug: `zz-teste-${Date.now()}`, name: 'ZZ Teste Ações' }
});
const account = await db.adAccount.create({
	data: {
		clientId: client.id,
		externalId: requireEnv('TEST_OWN_ACT'),
		name: 'Conta própria (teste)',
		maxDailyBudgetCents: 1000
	}
});

let campaignId = null;
try {
	const spec = SpecSchema.parse({
		campaignName: 'ZZ TESTE AÇÕES (apagar)',
		objective: 'TRAFFIC',
		budgetMode: 'CBO',
		campaignDailyBudgetCents: 600,
		destination: { url: 'https://example.com' },
		adSets: [{ name: 'x', dailyBudgetCents: 0, countries: ['BR'] }]
	});
	campaignId = await createCampaign({ externalId: account.externalId }, spec);
	await syncEntities(account);
	const entity = await db.metaEntity.findFirst({
		where: { accountId: account.id, externalId: campaignId }
	});
	check(
		'campanha de teste criada pausada e sincronizada',
		Boolean(entity) && entity.effectiveStatus === 'PAUSED',
		campaignId
	);

	// 1. Guarda: orçamento acima do teto da conta é recusado na proposta
	const overBudget = await rejects(() =>
		proposeAction({
			type: 'CHANGE_BUDGET',
			summary: 'x',
			payload: { accountId: account.id, entityId: campaignId, newDailyBudgetCents: 5000 },
			source: 'COPILOT',
			userId: admin.id
		})
	);
	check(
		'proposta acima do teto de segurança é recusada',
		/teto de segurança/.test(overBudget ?? ''),
		overBudget ?? 'aceitou!'
	);

	// 2. Guarda: entidade que não é da conta é recusada
	const foreign = await rejects(() =>
		proposeAction({
			type: 'PAUSE_ENTITY',
			summary: 'x',
			payload: { accountId: account.id, entityId: '999999999' },
			source: 'COPILOT',
			userId: admin.id
		})
	);
	check(
		'proposta sobre item de outra conta é recusada',
		/não pertence à conta/.test(foreign ?? ''),
		foreign ?? 'aceitou!'
	);

	// 3. Mudança de orçamento dentro do teto: COPILOT fica pendente e não mexe na Meta
	const prop = await proposeAction({
		type: 'CHANGE_BUDGET',
		summary: 'Orçamento para R$ 8',
		payload: { accountId: account.id, entityId: campaignId, newDailyBudgetCents: 800 },
		source: 'COPILOT',
		userId: admin.id
	});
	check('proposta do copiloto nasce pendente', prop.status === 'PENDING');
	let live = await graph(campaignId, { params: { fields: 'daily_budget' } });
	check(
		'Meta ainda com o orçamento antigo (nada executou)',
		live.daily_budget === '600',
		live.daily_budget
	);

	// 4. Aprovação executa de verdade
	await executeAction(prop.id, admin.id);
	live = await graph(campaignId, { params: { fields: 'daily_budget' } });
	check('após aprovar, a Meta mudou o orçamento', live.daily_budget === '800', live.daily_budget);

	// 5. Não executa duas vezes
	const twice = await rejects(() => executeAction(prop.id, admin.id));
	check(
		'ação não executa duas vezes',
		/já foi executada/.test(twice ?? ''),
		twice ?? 'executou de novo!'
	);

	// 6. Trava geral de escrita bloqueia
	await setSetting('metaWritesDisabled', true);
	const blockedProp = await proposeAction({
		type: 'CHANGE_BUDGET',
		summary: 'x',
		payload: { accountId: account.id, entityId: campaignId, newDailyBudgetCents: 700 },
		source: 'MANUAL',
		userId: admin.id
	});
	const blocked = await rejects(() => executeAction(blockedProp.id, admin.id));
	live = await graph(campaignId, { params: { fields: 'daily_budget' } });
	check(
		'trava geral bloqueia a escrita',
		/bloqueada/.test(blocked ?? '') && live.daily_budget === '800',
		blocked ?? 'executou!'
	);
	await setSetting('metaWritesDisabled', false);

	// 7. Auditoria registrou
	const logs = await db.auditLog.count({
		where: { accountId: account.id, action: 'meta.CHANGE_BUDGET' }
	});
	check('auditoria registrou as execuções (ok e falha)', logs >= 2, `${logs} registros`);
} finally {
	await setSetting('metaWritesDisabled', false);
	if (campaignId)
		await setStatus(campaignId, 'DELETED').catch((e) => console.log('limpeza falhou:', e.message));
	await db.auditLog.deleteMany({ where: { clientId: client.id } });
	await db.proposedAction.deleteMany({ where: { clientId: client.id } });
	await db.client.delete({ where: { id: client.id } });
	console.log('limpeza feita');
}

console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
process.exit(results.every(Boolean) ? 0 : 1);
