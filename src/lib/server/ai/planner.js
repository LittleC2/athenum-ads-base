// Planejador de campanha: o Claude monta a estrutura (conjuntos, público,
// orçamento, anúncios) a partir do briefing, do histórico real da conta e dos
// criativos e copys aprovados. O resultado é só uma proposta: o gestor revisa
// e edita antes de qualquer envio, e a validação trava o que for inseguro.
import { z } from 'zod';
import { structured } from './anthropic.js';
import { OBJECTIVES, SpecSchema, CTAS, totalDailyBudgetCents } from '../../campaignSpec.js';
import { cleanText } from '../../text.js';
import { brl } from '../../format.js';

const PlanSchema = z.object({
	spec: SpecSchema,
	rationale: z
		.string()
		.describe('Por que esta estrutura, em 3 a 6 frases, citando os dados da conta')
});

const SYSTEM = `Você é gestor de tráfego sênior da Athenum. Monta a estrutura de campanhas na Meta (Instagram e Facebook) para clientes.
Princípios (aprendidos em contas reais):
- Poucos conjuntos e poucos anúncios: 1 a 2 conjuntos, 3 a 6 anúncios por conjunto. Fragmentar demais dilui a verba e atrasa o aprendizado.
- Repita o formato e a mensagem do que já funcionou na conta (veja o histórico). Vídeo costuma superar imagem quando o histórico mostra isso.
- Público aberto com Advantage+ funciona bem; interesses de procedimento de saúde não existem mais na Meta. Se o cliente exige corte de idade ou gênero, desligue Advantage+.
- Posicionamento: Stories e Reels do Instagram costumam ter custo menor; evite o feed do Instagram se o histórico mostrar custo maior.
- Respeite o teto de orçamento diário informado. Comece conservador.
- Anúncios devem usar apenas criativos (assetId) da lista recebida e, quando possível, copys já aprovadas. Nunca invente assetId.
- Cada anúncio tem nome único dentro do conjunto (ex: "AD 1 - antes e depois (video)").
- Texto: português do Brasil, sem emoji, sem travessão, sem promessa de resultado em saúde.
- Botão (cta) deve ser um dos permitidos para o objetivo.`;

/**
 * @param {{ objective: string, account: object, client: object, brief: object|null, instructions: string,
 *   assets: { id: string, name: string, kind: string }[], copies: { primaryText: string, headline: string, description: string|null, angle: string }[],
 *   history: { bestAds: object[], placementHint: string|null }, name: string }} input
 */
export async function planCampaign(input) {
	const { objective, account, client, brief, instructions, assets, copies, history, name } = input;
	const maxDaily = account.maxDailyBudgetCents;

	const user = [
		`Cliente: ${client.name} (${client.segment ?? 'sem segmento'})`,
		`Objetivo: ${OBJECTIVES[objective].label} (${objective})`,
		`Nome da campanha: ${name}`,
		`Botões permitidos: ${CTAS[objective].join(', ')}`,
		maxDaily
			? `Teto de orçamento diário total: ${brl(maxDaily)} (em centavos: ${maxDaily})`
			: 'Sem teto cadastrado: use no máximo R$ 50,00 por dia (5000 centavos).',
		brief
			? `Briefing:\n- Oferta: ${brief.offer ?? '-'}\n- Público: ${brief.audience ?? '-'}\n- Tom: ${brief.tone ?? '-'}\n- Restrições: ${brief.restrictions ?? '-'}\n- Extra: ${brief.extra ?? '-'}`
			: 'Sem briefing.',
		history.bestAds.length
			? `Melhores anúncios da conta (resultado e custo):\n${history.bestAds.map((a) => `- ${a.name}: ${a.results} resultados, ${a.cost}`).join('\n')}`
			: 'Sem histórico de anúncios.',
		history.placementHint ? `Dica de posicionamento do histórico: ${history.placementHint}` : '',
		`Criativos disponíveis (use o id em assetId):\n${assets.length ? assets.map((a) => `- id=${a.id} | ${a.kind} | ${a.name}`).join('\n') : '(nenhum: deixe os anúncios sem criativo e explique)'}`,
		copies.length
			? `Copys aprovadas:\n${copies.map((c) => `- [${c.angle}] texto: ${c.primaryText} | título: ${c.headline} | descrição: ${c.description ?? ''}`).join('\n')}`
			: 'Sem copys aprovadas: escreva você, seguindo as regras.',
		instructions.trim() ? `Instruções do gestor: ${instructions}` : ''
	]
		.filter(Boolean)
		.join('\n\n');

	const out = await structured({
		system: SYSTEM,
		user,
		toolName: 'propor_campanha',
		toolDescription: 'Entrega a estrutura proposta da campanha e a justificativa.',
		schema: PlanSchema,
		maxTokens: 6000
	});

	// Pós-processamento: nada que a IA devolva escapa das regras do app.
	const spec = out.spec;
	spec.objective = objective;
	spec.campaignName = cleanText(spec.campaignName || name);
	const known = new Set(assets.map((a) => a.id));
	for (const s of spec.adSets) {
		s.ads = s.ads
			.filter((a) => known.has(a.assetId))
			.map((a) => ({
				...a,
				primaryText: cleanText(a.primaryText),
				headline: cleanText(a.headline),
				description: cleanText(a.description ?? ''),
				cta: CTAS[objective].includes(a.cta) ? a.cta : CTAS[objective][0]
			}));
	}
	const total = totalDailyBudgetCents(spec);
	const cap = maxDaily ?? 5000;
	if (total > cap && total > 0) {
		const f = cap / total;
		spec.campaignDailyBudgetCents = Math.floor(spec.campaignDailyBudgetCents * f);
		for (const s of spec.adSets) s.dailyBudgetCents = Math.floor(s.dailyBudgetCents * f);
	}
	return { spec: SpecSchema.parse(spec), rationale: cleanText(out.rationale) };
}
