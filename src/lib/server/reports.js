// Geração de relatório: reúne os fatos da conta, pede o texto ao Claude (ou usa
// o modelo sem IA) e grava como RASCUNHO. Só o gestor publica pro portal.
import { z } from 'zod';
import { db } from './db.js';
import { loadDashboardForPeriod } from './dashboard.js';
import { hasAnthropic, structured } from './ai/anthropic.js';
import { toDbDate, fullBR } from '../dates.js';
import { brl, decimal, pct, signedPct } from '../format.js';
import { RESULT_LABELS } from '../metrics.js';
import { cleanText } from '../text.js';
import { templateReport } from '../reportTemplate.js';

const OutputSchema = z.object({
	title: z.string().max(120),
	clientSummary: z.string().min(40),
	internalAnalysis: z.string().min(40),
	recommendations: z
		.array(
			z.object({
				priority: z.enum(['alta', 'media', 'baixa']),
				action: z.string(),
				reason: z.string()
			})
		)
		.max(8)
});

const SYSTEM = `Você escreve relatórios de tráfego pago da Athenum, agência de marketing digital.
Regras de escrita (valem para todo texto):
- Português do Brasil, tom formal mas com linguagem familiar e acessível. Direto, sem soar vendedor.
- Nunca use emoji, travessão (—) nem jargão de guru (alavancar, sinergia). Use vírgula, dois-pontos ou frase nova.
- Use SOMENTE os números dos fatos recebidos, copiados exatamente como estão. Nunca invente, arredonde por conta própria nem estime o que não foi dado.
- Reporte perda sem amenizar: "o anúncio X gastou R$ 54,89 sem trazer resultado" é melhor que "desempenho abaixo do esperado".
- Nunca prometa resultado, cura ou garantia (o cliente pode ser da área da saúde).

clientSummary: texto para o CLIENTE ler em 1 minuto. 120 a 220 palavras. Sem sigla técnica (nada de CPM, CTR, CPL, frequência, lookalike): diga "custo por conversa", "pessoas alcançadas". Abra com o resultado principal e a comparação com o período anterior, explique em uma frase o motivo das variações, cite o ritmo do orçamento do mês se houver e termine com "Próximos passos" em até 3 itens curtos, em lista com hífen. Use **negrito** só nos números principais.

internalAnalysis: análise para o GESTOR em markdown com seções "## Resumo", "## O que está funcionando", "## O que está dando errado", "## Alertas", "## Recomendações". Pode usar termos técnicos (CPM, CTR, frequência). Cite campanhas e anúncios pelo nome, com valores.

recommendations: ações concretas (nome da campanha ou anúncio, valor, motivo), da mais urgente para a menos urgente.`;

/** Fatos formatados pra o prompt: o modelo recebe texto pronto, nunca centavos. */
function promptFacts(f) {
	const l = RESULT_LABELS[f.resultType];
	const money = (c) => (c == null ? null : brl(c));
	return {
		cliente: f.clientName,
		periodo: `${fullBR(f.since)} a ${fullBR(f.until)}`,
		tipo_de_resultado: l.title,
		atual: {
			investido: money(f.cur.spendCents),
			resultados: f.cur.results,
			custo_por_resultado: money(f.cur.costCents),
			alcance: f.cur.reach,
			frequencia: f.cur.frequency != null ? decimal(f.cur.frequency) : null,
			ctr_link: f.cur.ctr != null ? pct(f.cur.ctr, 2) : null,
			cpm: money(f.cur.cpmCents),
			profundidade_conversa: f.cur.depthRate != null ? pct(f.cur.depthRate, 0) : null
		},
		periodo_anterior: {
			investido: money(f.prev.spendCents),
			resultados: f.prev.results,
			custo_por_resultado: money(f.prev.costCents)
		},
		variacao: {
			investido: f.changes.spend != null ? signedPct(f.changes.spend, 0) : null,
			resultados: f.changes.results != null ? signedPct(f.changes.results, 0) : null,
			custo_por_resultado: f.changes.cost != null ? signedPct(f.changes.cost, 0) : null
		},
		custo_alvo: money(f.targetCostCents),
		orcamento_mensal: f.pacing
			? {
					gasto_no_mes: money(f.pacing.spentCents),
					planejado: money(f.pacing.monthlyBudgetCents),
					projecao_do_mes: money(f.pacing.projectedCents)
				}
			: null,
		campanhas: f.campaigns.slice(0, 6).map((c) => ({
			nome: c.name,
			investido: money(c.spendCents),
			resultados: c.results,
			custo: money(c.costCents)
		})),
		melhores_anuncios: f.bestAds.map((a) => ({
			nome: a.name,
			investido: money(a.spendCents),
			resultados: a.results,
			custo: money(a.costCents)
		})),
		anuncios_sem_resultado: f.worstAds.map((a) => ({
			nome: a.name,
			investido: money(a.spendCents),
			resultados: a.results
		})),
		alertas_abertos: f.alerts.map((a) => ({
			gravidade: a.severity,
			titulo: a.title,
			detalhe: a.detail
		})),
		retorno_informado_pelo_cliente: f.feedback
			? {
					com_interesse: f.feedback.qualified,
					viraram_cliente: f.feedback.sales,
					valor_vendido: money(f.feedback.revenueCents)
				}
			: null,
		briefing: f.brief
	};
}

/** @returns {Promise<import('../reportTemplate.js').ReportFacts & { brief: object|null }>} */
export async function buildFacts(account, period) {
	const [dash, alerts, feedbackRows, client] = await Promise.all([
		loadDashboardForPeriod(account, period),
		db.alert.findMany({
			where: { accountId: account.id, status: 'OPEN' },
			orderBy: { severity: 'asc' }
		}),
		db.resultFeedback.findMany({
			where: {
				clientId: account.clientId,
				periodStart: { lte: toDbDate(period.until) },
				periodEnd: { gte: toDbDate(period.since) }
			}
		}),
		db.client.findUnique({ where: { id: account.clientId }, include: { brief: true } })
	]);

	const paid = dash.ads.filter((a) => a.spendCents > 0);
	const bestAds = paid
		.filter((a) => a.results > 0 && a.spendCents >= 1000)
		.sort((a, b) => (a.costCents ?? Infinity) - (b.costCents ?? Infinity))
		.slice(0, 3);
	const worstAds = paid
		.filter((a) => a.results === 0 && a.spendCents >= 2000)
		.sort((a, b) => b.spendCents - a.spendCents)
		.slice(0, 3);

	const feedback = feedbackRows.length
		? feedbackRows.reduce(
				(acc, f) => ({
					qualified: (acc.qualified ?? 0) + (f.qualified ?? 0),
					sales: (acc.sales ?? 0) + (f.sales ?? 0),
					revenueCents: (acc.revenueCents ?? 0) + (f.revenueCents ?? 0)
				}),
				{ qualified: null, sales: null, revenueCents: null }
			)
		: null;

	return {
		clientName: client?.name ?? '',
		resultType: account.resultType,
		since: period.since,
		until: period.until,
		cur: dash.cur,
		prev: dash.prev,
		changes: dash.changes,
		campaigns: dash.campaigns.filter((c) => c.spendCents > 0),
		bestAds,
		worstAds,
		pacing: dash.pacing,
		alerts: alerts.map((a) => ({
			severity: a.severity,
			kind: a.kind,
			title: a.title,
			detail: a.detail,
			entityName: a.entityName,
			visibleToClient: a.visibleToClient
		})),
		feedback,
		targetCostCents: account.targetCostCents,
		brief: client?.brief
			? {
					oferta: client.brief.offer,
					publico: client.brief.audience,
					tom: client.brief.tone,
					restricoes: client.brief.restrictions
				}
			: null
	};
}

/** Gera o texto: IA quando há chave, modelo sem IA como reserva. */
export async function writeReport(facts) {
	if (hasAnthropic()) {
		try {
			const out = await structured({
				system: SYSTEM,
				user: `Escreva o relatório com estes fatos (JSON):\n${JSON.stringify(promptFacts(facts), null, 2)}`,
				toolName: 'escrever_relatorio',
				toolDescription:
					'Entrega o relatório do período: título, resumo do cliente, análise interna e recomendações.',
				schema: OutputSchema,
				maxTokens: 4500
			});
			return {
				generatedBy: 'claude',
				title: cleanText(out.title),
				clientSummary: cleanText(out.clientSummary),
				internalAnalysis: cleanText(out.internalAnalysis),
				recommendations: out.recommendations.map((r) => ({
					...r,
					action: cleanText(r.action),
					reason: cleanText(r.reason)
				}))
			};
		} catch (err) {
			console.error('[reports] IA falhou, usando modelo sem IA:', err.message);
		}
	}
	return { generatedBy: 'template', ...templateReport(facts) };
}

/** Cria o rascunho de relatório de uma conta pro período. */
export async function createReportDraft(account, period) {
	const facts = await buildFacts(account, period);
	const written = await writeReport(facts);
	const l = RESULT_LABELS[account.resultType];
	return db.report.create({
		data: {
			clientId: account.clientId,
			accountId: account.id,
			kind: 'SEMANAL',
			periodStart: toDbDate(period.since),
			periodEnd: toDbDate(period.until),
			status: 'DRAFT',
			title: written.title,
			clientSummary: written.clientSummary,
			internalAnalysis: written.internalAnalysis,
			recommendations: written.recommendations,
			generatedBy: written.generatedBy,
			kpis: {
				spendCents: facts.cur.spendCents,
				results: facts.cur.results,
				costCents: facts.cur.costCents,
				reach: facts.cur.reach,
				resultTitle: l.title,
				periodSince: facts.since,
				periodUntil: facts.until
			}
		}
	});
}
