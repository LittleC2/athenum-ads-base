// Acesso à API da Anthropic. Sem ANTHROPIC_API_KEY o app continua funcionando:
// relatórios saem do modelo de texto e o copiloto avisa que precisa da chave.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '$env/dynamic/private';

let client = null;

export function hasAnthropic() {
	return Boolean(env.ANTHROPIC_API_KEY);
}

export function getAnthropic() {
	if (!env.ANTHROPIC_API_KEY) return null;
	client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
	return client;
}

export function model() {
	return env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
}

/** JSON Schema do zod sem a chave $schema (a API da Anthropic só precisa do corpo). */
export function inputSchema(schema) {
	const { $schema, ...rest } = z.toJSONSchema(schema);
	void $schema;
	return rest;
}

/**
 * Pede uma resposta estruturada: força o uso de uma ferramenta cujo schema é o
 * formato desejado e valida o retorno com zod.
 * @template T
 * @param {{ system: string, user: string, toolName: string, toolDescription: string,
 *   schema: import('zod').ZodType<T>, maxTokens?: number }} opts
 * @returns {Promise<T>}
 */
export async function structured({
	system,
	user,
	toolName,
	toolDescription,
	schema,
	maxTokens = 4000
}) {
	const anthropic = getAnthropic();
	if (!anthropic) throw new Error('ANTHROPIC_API_KEY não configurada.');

	// Este modelo não aceita forçar a ferramenta (tool_choice), então a instrução vai no
	// prompt. Se a resposta vier sem a chamada, pedimos uma vez de novo.
	const tools = [
		{ name: toolName, description: toolDescription, input_schema: inputSchema(schema) }
	];
	const systemPrompt = `${system}\n\nEntregue o resultado SEMPRE chamando a ferramenta "${toolName}", sem escrever texto fora dela.`;
	const messages = [{ role: 'user', content: user }];

	let block;
	for (let attempt = 0; attempt < 2 && !block; attempt++) {
		const response = await anthropic.messages.create({
			model: model(),
			max_tokens: maxTokens,
			system: systemPrompt,
			messages,
			tools
		});
		block = response.content.find((b) => b.type === 'tool_use' && b.name === toolName);
		if (!block) {
			messages.push({ role: 'assistant', content: response.content });
			messages.push({
				role: 'user',
				content: `Entregue agora chamando a ferramenta "${toolName}".`
			});
		}
	}
	if (!block) throw new Error('A IA não devolveu a resposta no formato esperado.');

	const parsed = schema.safeParse(block.input);
	if (!parsed.success)
		throw new Error(
			`Resposta da IA fora do formato: ${parsed.error.issues[0]?.message ?? 'inválida'}`
		);
	return parsed.data;
}
