// Laboratório de copys: o Claude escreve variantes por ângulo, e cada uma
// passa pela checagem automática (limites, saúde, travessão) antes de ir
// pra revisão do gestor.
import { z } from 'zod';
import { structured } from './anthropic.js';
import { cleanText } from '../../text.js';
import { lintCopy } from '../../copyLint.js';
import { OBJECTIVES } from '../../campaignSpec.js';

const VariantsSchema = z.object({
	variants: z
		.array(
			z.object({
				angle: z
					.string()
					.describe('Ângulo da mensagem em poucas palavras, ex: "dor: demora no atendimento"'),
				primaryText: z
					.string()
					.describe('Texto principal. A primeira linha tem até 125 caracteres e prende a atenção.'),
				headline: z.string().describe('Título, até 40 caracteres'),
				description: z.string().describe('Descrição curta, até 30 caracteres. Pode ficar vazia.')
			})
		)
		.min(1)
		.max(12)
});

const SYSTEM = `Você é redator de anúncios de resposta direta da Athenum, agência de marketing digital, escrevendo para a Meta (Instagram e Facebook).
Regras:
- Português do Brasil, tom formal mas com linguagem familiar e acessível. Direto, sem soar vendedor genérico.
- Nunca use emoji, travessão (—) nem jargão de guru (alavancar, sinergia, "vamos juntos").
- Cada variante usa um ÂNGULO diferente (dor, prova, curiosidade, objeção, oferta, demonstração). Não repita a mesma ideia com outras palavras.
- Primeira linha do texto principal: até 125 caracteres, é o que aparece antes do "ver mais".
- Título até 40 caracteres, descrição até 30.
- Setor de saúde e estética: nunca prometa resultado, cura, garantia, "100%", "sem dor" nem afirme condição da pessoa ("você tem acne"). Fale de avaliação, cuidado, naturalidade e atendimento.
- Use só fatos do briefing. Não invente preço, prazo, depoimento nem número.
- O botão e o destino são definidos fora: não escreva "clique no link" nem "chame no WhatsApp" de um jeito que dependa do botão.`;

/**
 * @param {{ objective: string, brief: object|null, clientName: string, angles: string, count: number,
 *   instructions: string, existing: string[] }} input
 */
export async function generateCopies({
	objective,
	brief,
	clientName,
	angles,
	count,
	instructions,
	existing
}) {
	const user = [
		`Cliente: ${clientName}`,
		`Objetivo da campanha: ${OBJECTIVES[objective]?.label ?? objective}`,
		brief
			? `Briefing:\n- Oferta: ${brief.offer ?? '-'}\n- Público: ${brief.audience ?? '-'}\n- Tom: ${brief.tone ?? '-'}\n- Restrições (nunca dizer): ${brief.restrictions ?? '-'}\n- Outras informações: ${brief.extra ?? '-'}`
			: 'Sem briefing cadastrado.',
		angles.trim()
			? `Ângulos pedidos: ${angles}`
			: 'Escolha os ângulos mais fortes para este cliente.',
		instructions.trim() ? `Instruções extras: ${instructions}` : '',
		existing.length
			? `Textos que já existem (não repita a ideia):\n${existing
					.slice(0, 10)
					.map((t) => `- ${t.slice(0, 140)}`)
					.join('\n')}`
			: '',
		`Escreva ${count} variantes.`
	]
		.filter(Boolean)
		.join('\n\n');

	const out = await structured({
		system: SYSTEM,
		user,
		toolName: 'entregar_variantes',
		toolDescription: 'Entrega as variantes de copy para revisão.',
		schema: VariantsSchema,
		maxTokens: 4000
	});

	return out.variants.map((v) => {
		const copy = {
			angle: cleanText(v.angle),
			primaryText: cleanText(v.primaryText),
			headline: cleanText(v.headline),
			description: cleanText(v.description)
		};
		return { ...copy, lintFlags: lintCopy(copy) };
	});
}
