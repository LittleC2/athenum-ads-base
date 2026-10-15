// Testa a IA de verdade (usa a ANTHROPIC_API_KEY do .env; custo pequeno).
// Uso: npx vite-node --config vitest.config.js scripts/ai-live-test.js
import { requireEnv } from './_env.js';
import { db } from '../src/lib/server/db.js';
import { generateCopies } from '../src/lib/server/ai/copy.js';
import { createReportDraft } from '../src/lib/server/reports.js';
import { planCampaign } from '../src/lib/server/ai/planner.js';
import { accountHistory } from '../src/lib/server/ai/history.js';
import { copilotReply, clearCopilotHistory } from '../src/lib/server/ai/copilot.js';
import { periodFromPreset } from '../src/lib/dates.js';
import { hasDash } from '../src/lib/text.js';

const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${extra ? ' | ' + extra : ''}`);
};
const account = await db.adAccount.findUnique({
	where: { externalId: requireEnv('TEST_ACT') },
	include: { client: true }
});
const brief = await db.clientBrief.findUnique({ where: { clientId: account.clientId } });

try {
	const copies = await generateCopies({
		objective: 'LEADS_WHATSAPP',
		brief,
		clientName: account.client.name,
		angles: 'naturalidade, avaliação',
		count: 2,
		instructions: '',
		existing: []
	});
	check('copys geradas pela IA', copies.length >= 1, `${copies.length} variantes`);
	check(
		'copys sem travessão',
		copies.every((c) => !hasDash(c.primaryText + c.headline))
	);
	console.log(
		'   exemplo:',
		copies[0].headline,
		'|',
		copies[0].primaryText.slice(0, 110).replace(/\n/g, ' ')
	);
	console.log('   avisos:', JSON.stringify(copies[0].lintFlags.map((f) => f.code)));
} catch (e) {
	check('copys geradas pela IA', false, e.message.slice(0, 200));
}

try {
	const r = await createReportDraft(account, periodFromPreset('7d'));
	check('relatório escrito pelo Claude', r.generatedBy === 'claude', r.generatedBy);
	check(
		'relatório do cliente sem travessão e com números',
		!hasDash(r.clientSummary) && /R\$/.test(r.clientSummary)
	);
	console.log('   resumo (início):', r.clientSummary.slice(0, 200).replace(/\n/g, ' '));
	await db.report.delete({ where: { id: r.id } });
} catch (e) {
	check('relatório escrito pelo Claude', false, e.message.slice(0, 200));
}

try {
	const history = await accountHistory(account);
	const plan = await planCampaign({
		objective: 'LEADS_WHATSAPP',
		account,
		client: account.client,
		brief,
		instructions: 'um conjunto, mulheres de Uberlândia',
		assets: [],
		copies: [],
		history,
		name: 'ZZ plano teste'
	});
	check(
		'planejador devolveu estrutura válida',
		plan.spec.adSets.length >= 1,
		`${plan.spec.adSets.length} conjunto(s)`
	);
	console.log('   justificativa:', plan.rationale.slice(0, 160).replace(/\n/g, ' '));
} catch (e) {
	check('planejador devolveu estrutura válida', false, e.message.slice(0, 200));
}

try {
	const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
	await clearCopilotHistory(admin.id);
	const before = await db.proposedAction.count();
	const stream = await copilotReply({
		userId: admin.id,
		message: 'Em uma frase por cliente: como estão as contas nos últimos 7 dias?'
	});
	const reader = stream.getReader();
	const dec = new TextDecoder();
	let text = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		text += dec.decode(value, { stream: true });
	}
	check(
		'copiloto respondeu usando as ferramentas',
		new RegExp(account.client.name.split(' ')[0]).test(text),
		text.length + ' caracteres'
	);
	check('copiloto não criou ação sem pedir', (await db.proposedAction.count()) === before);
	console.log('   resposta:', text.slice(0, 400).replace(/\n/g, ' '));
	await clearCopilotHistory(admin.id);
} catch (e) {
	check('copiloto respondeu usando as ferramentas', false, e.message.slice(0, 200));
}

console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
await db.$disconnect();
