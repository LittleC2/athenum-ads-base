// Testa o laço do copiloto (ferramentas de leitura + proposta) com um servidor
// falso que imita o streaming da API da Anthropic. Não gasta chave nem toca na Meta.
// Uso: npx vite-node --config vitest.config.js scripts/copilot-fake-api-test.js
import http from 'node:http';
import { requireEnv } from './_env.js';

process.env.ANTHROPIC_API_KEY = 'chave-falsa-de-teste';

const { db } = await import('../src/lib/server/db.js');

const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${extra ? ' | ' + extra : ''}`);
};

// Entidade real da conta de teste (TEST_ACT) pra a "IA" propor pausar.
const account = await db.adAccount.findUnique({ where: { externalId: requireEnv('TEST_ACT') } });
const clientRow = await db.client.findUnique({ where: { id: account.clientId } });
const clientName = new RegExp(clientRow.name.split(' ')[0]);
const entity = await db.metaEntity.findFirst({
	where: { accountId: account.id, level: 'AD', effectiveStatus: 'ACTIVE' }
});
if (!entity) throw new Error('Sincronize a conta de teste antes (precisa de um anúncio ativo).');
const statusBefore = entity.effectiveStatus;

const seenRequests = [];
const sse = (events) =>
	events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const msgStart = {
	type: 'message_start',
	message: {
		id: 'msg_t',
		type: 'message',
		role: 'assistant',
		model: 'fake',
		content: [],
		stop_reason: null,
		stop_sequence: null,
		usage: { input_tokens: 1, output_tokens: 1 }
	}
};
const textBlock = (i, text) => [
	{ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } },
	{ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text } },
	{ type: 'content_block_stop', index: i }
];
const toolBlock = (i, id, name, input) => [
	{
		type: 'content_block_start',
		index: i,
		content_block: { type: 'tool_use', id, name, input: {} }
	},
	{
		type: 'content_block_delta',
		index: i,
		delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) }
	},
	{ type: 'content_block_stop', index: i }
];
const end = (reason) => [
	{
		type: 'message_delta',
		delta: { stop_reason: reason, stop_sequence: null },
		usage: { output_tokens: 5 }
	},
	{ type: 'message_stop' }
];

const server = http.createServer((req, res) => {
	let body = '';
	req.on('data', (c) => (body += c));
	req.on('end', () => {
		const payload = JSON.parse(body || '{}');
		seenRequests.push(payload);
		const last = payload.messages.at(-1);
		const lastResult = Array.isArray(last.content)
			? last.content.find((b) => b.type === 'tool_result')
			: null;
		let events;
		if (!lastResult) {
			events = [
				msgStart,
				...textBlock(0, 'Vou consultar as contas. '),
				...toolBlock(1, 'toolu_1', 'listar_clientes', {}),
				...end('tool_use')
			];
		} else if (clientName.test(lastResult.content) && !/propostaCriada/.test(lastResult.content)) {
			events = [
				msgStart,
				...toolBlock(0, 'toolu_2', 'propor_pausar', {
					accountId: account.id,
					entityId: entity.externalId,
					nome: entity.name,
					motivo: 'gastou sem resultado (teste)'
				}),
				...end('tool_use')
			];
		} else {
			events = [
				msgStart,
				...textBlock(
					0,
					'Deixei a proposta de pausa aguardando a sua aprovação. Nada foi alterado na Meta.'
				),
				...end('end_turn')
			];
		}
		res.writeHead(200, { 'Content-Type': 'text/event-stream' });
		res.end(sse(events));
	});
});
await new Promise((r) => server.listen(0, r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;

const { copilotReply, copilotHistory, clearCopilotHistory } =
	await import('../src/lib/server/ai/copilot.js');
const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
await clearCopilotHistory(admin.id);

const pendingBefore = await db.proposedAction.count({
	where: { status: 'PENDING', source: 'COPILOT' }
});
const stream = await copilotReply({ userId: admin.id, message: 'Quais anúncios devo pausar?' });
const reader = stream.getReader();
const decoder = new TextDecoder();
let text = '';
for (;;) {
	const { done, value } = await reader.read();
	if (done) break;
	text += decoder.decode(value, { stream: true });
}
server.close();

check(
	'texto do modelo chegou em streaming',
	/Vou consultar as contas/.test(text) && /aguardando a sua aprovação/.test(text),
	text.slice(0, 80)
);
check('laço fez 3 chamadas ao modelo', seenRequests.length === 3, `${seenRequests.length}`);
const toolResult1 = seenRequests[1].messages.at(-1).content[0].content;
check(
	'ferramenta de leitura devolveu dados reais ao modelo',
	clientName.test(toolResult1) && /accountId/.test(toolResult1)
);
check(
	'ferramentas foram enviadas ao modelo',
	seenRequests[0].tools.some((t) => t.name === 'propor_pausar') &&
		seenRequests[0].tools.length >= 10,
	`${seenRequests[0].tools.length} ferramentas`
);
check(
	'chamada usa o prompt do sistema com cache',
	seenRequests[0].system?.[0]?.cache_control?.type === 'ephemeral'
);

const pendingAfter = await db.proposedAction.findMany({
	where: { status: 'PENDING', source: 'COPILOT' },
	orderBy: { createdAt: 'desc' }
});
check(
	'proposta ficou PENDENTE na fila',
	pendingAfter.length === pendingBefore + 1 && pendingAfter[0].type === 'PAUSE_ENTITY'
);
const entityAfter = await db.metaEntity.findUnique({ where: { id: entity.id } });
check('nada foi alterado (status do anúncio igual)', entityAfter.effectiveStatus === statusBefore);

const hist = await copilotHistory(admin.id);
check(
	'conversa foi salva (pergunta e resposta)',
	hist.length === 2 && hist[1].role === 'assistant'
);

// A fila exige aprovação: a ação do copiloto não executa sozinha.
check(
	'ação do copiloto não nasce aprovada',
	pendingAfter[0].status === 'PENDING' && pendingAfter[0].decidedById === null
);

// limpeza
await db.proposedAction.deleteMany({ where: { id: pendingAfter[0].id } });
await clearCopilotHistory(admin.id);

console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
process.exit(results.every(Boolean) ? 0 : 1);
