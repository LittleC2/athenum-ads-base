// Copiloto do gestor: conversa com o Claude com ferramentas. Lê dados da conta
// à vontade e PROPÕE mudanças; quem executa é sempre o gestor, na fila de Ações.
import { db } from '../db.js';
import { getAnthropic, inputSchema, model } from './anthropic.js';
import { TOOLS } from './copilotTools.js';
import { cleanText } from '../../text.js';

const HISTORY_LIMIT = 24;
const MAX_STEPS = 8;

const SYSTEM = `Você é o copiloto de tráfego pago da Athenum, agência de marketing digital de 2 pessoas. Conversa com o gestor (Carlos) dentro da plataforma Athenum Ads, que cuida das contas de anúncios dos clientes na Meta.

Como trabalhar:
- Responda em português do Brasil, direto e prático, tom formal mas familiar. Sem emoji, sem travessão (use vírgula, dois-pontos ou frase nova) e sem jargão de guru.
- Para qualquer dado de conta, USE AS FERRAMENTAS. Nunca invente número: copie os valores exatamente como a ferramenta devolveu. Se faltar dado, diga que falta.
- Comece por listar_clientes quando precisar de ids.
- Você NÃO altera nada na Meta. As ferramentas propor_* só colocam uma proposta na fila de Ações, que o gestor aprova. Depois de propor, diga claramente que ficou aguardando aprovação e que nada foi alterado ainda. Nunca diga que pausou, ativou ou mudou algo.
- Ao propor, explique o motivo com números (ex: "gastou R$ 54,89 sem nenhuma conversa em 14 dias") e proponha só o que os dados sustentam.
- Reporte perda sem amenizar. Compare períodos antes de concluir. Lembre que o custo por resultado sozinho não mostra se a venda aconteceu: o cliente informa o retorno na aba Resultados.
- Setor de saúde: nunca prometa resultado nem cura em texto de anúncio.
- Respostas curtas quando a pergunta for simples; mais completas para análises.`;

function toolDefs() {
	return TOOLS.map((t) => ({
		name: t.name,
		description: t.description,
		input_schema: inputSchema(t.schema)
	}));
}

async function runTool(name, input, ctx) {
	const tool = TOOLS.find((t) => t.name === name);
	if (!tool) return { error: `Ferramenta desconhecida: ${name}` };
	const parsed = tool.schema.safeParse(input ?? {});
	if (!parsed.success) return { error: `Parâmetros inválidos: ${parsed.error.issues[0]?.message}` };
	try {
		return await tool.run(parsed.data, ctx);
	} catch (err) {
		return { error: err.message };
	}
}

async function threadFor(userId) {
	return (
		(await db.chatThread.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })) ??
		db.chatThread.create({ data: { userId, title: 'Copiloto' } })
	);
}

export async function copilotHistory(userId) {
	const thread = await threadFor(userId);
	const messages = await db.chatMessage.findMany({
		where: { threadId: thread.id },
		orderBy: { createdAt: 'desc' },
		take: HISTORY_LIMIT
	});
	return messages.reverse().map((m) => ({ role: m.role, content: m.content }));
}

export async function clearCopilotHistory(userId) {
	const thread = await threadFor(userId);
	await db.chatMessage.deleteMany({ where: { threadId: thread.id } });
}

/** Resposta em streaming (texto puro). Salva a conversa quando termina. */
export async function copilotReply({ userId, message }) {
	const anthropic = getAnthropic();
	if (!anthropic) throw new Error('O copiloto precisa da ANTHROPIC_API_KEY configurada.');

	const thread = await threadFor(userId);
	const history = await copilotHistory(userId);
	await db.chatMessage.create({ data: { threadId: thread.id, role: 'user', content: message } });

	const convo = [...history, { role: 'user', content: message }];
	const encoder = new TextEncoder();
	let answer = '';

	return new ReadableStream({
		async start(controller) {
			const push = (text) => {
				answer += text;
				controller.enqueue(encoder.encode(text));
			};
			try {
				for (let step = 0; step < MAX_STEPS; step++) {
					const stream = anthropic.messages.stream({
						model: model(),
						max_tokens: 3000,
						system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
						tools: toolDefs(),
						messages: convo
					});
					stream.on('text', (t) => push(t));
					const final = await stream.finalMessage();
					if (final.stop_reason !== 'tool_use') break;

					convo.push({ role: 'assistant', content: final.content });
					const results = [];
					for (const block of final.content.filter((b) => b.type === 'tool_use')) {
						const out = await runTool(block.name, block.input, { adminId: userId });
						results.push({
							type: 'tool_result',
							tool_use_id: block.id,
							content: JSON.stringify(out).slice(0, 14000)
						});
					}
					convo.push({ role: 'user', content: results });
					if (answer && !answer.endsWith('\n')) push('\n\n');
				}
			} catch (err) {
				push(`\n\nNão consegui concluir: ${err.message}`);
			} finally {
				const clean = cleanText(answer);
				if (clean)
					await db.chatMessage
						.create({ data: { threadId: thread.id, role: 'assistant', content: clean } })
						.catch(() => {});
				controller.close();
			}
		}
	});
}
