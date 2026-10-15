// Relatório sem IA: texto de modelo montado só com os números. Serve de
// reserva quando não há chave da Anthropic e de base de comparação pro texto
// gerado. Módulo puro.
import { brl, int, pct, signedPct, decimal } from './format.js';
import { fullBR } from './dates.js';
import { RESULT_LABELS } from './metrics.js';
import { cleanText } from './text.js';

/**
 * @typedef {object} ReportFacts
 * @property {string} clientName
 * @property {string} resultType
 * @property {string} since
 * @property {string} until
 * @property {{ spendCents: number, results: number, costCents: number|null, reach: number|null, frequency: number|null, ctr: number|null, cpmCents: number|null, depthRate: number|null }} cur
 * @property {{ spendCents: number, results: number, costCents: number|null }} prev
 * @property {{ spend: number|null, results: number|null, cost: number|null }} changes
 * @property {{ name: string, status: string|null, spendCents: number, results: number, costCents: number|null }[]} campaigns
 * @property {{ name: string, spendCents: number, results: number, costCents: number|null }[]} bestAds
 * @property {{ name: string, spendCents: number, results: number, costCents: number|null }[]} worstAds
 * @property {object|null} pacing
 * @property {{ severity: string, kind: string, title: string, detail: string, visibleToClient: boolean }[]} alerts
 * @property {{ qualified: number|null, sales: number|null, revenueCents: number|null }|null} feedback
 * @property {number|null} targetCostCents
 */

function clientActions(facts) {
	const kinds = new Set(facts.alerts.map((a) => a.kind));
	const items = [];
	if (kinds.has('NO_RESULT_SPEND'))
		items.push(
			'pausar os anúncios que gastaram sem trazer resultado e passar a verba para os que funcionam'
		);
	if (kinds.has('FREQUENCY_HIGH') || kinds.has('COST_RISING') || kinds.has('CPM_SPIKE')) {
		items.push('renovar os criativos e testar novas mensagens para manter o custo baixo');
	}
	if (kinds.has('OPPORTUNITY')) items.push('dar mais verba ao anúncio que está com o melhor custo');
	if (kinds.has('BUDGET_PACING')) items.push('alinhar o orçamento do mês com você');
	if (!facts.feedback?.sales) {
		items.push(
			'contar com a sua ajuda: informe na aba Resultados quantos contatos viraram cliente, para calcularmos o custo real de cada cliente'
		);
	}
	return items.slice(0, 4);
}

/** @param {ReportFacts} facts */
export function templateClientSummary(facts) {
	const l = RESULT_LABELS[facts.resultType] ?? RESULT_LABELS.LEAD_FORM;
	const { cur, prev, changes } = facts;
	const parts = [];

	parts.push(
		`No período de ${fullBR(facts.since)} a ${fullBR(facts.until)}, investimos **${brl(cur.spendCents)}** e geramos **${int(cur.results)} ${cur.results === 1 ? l.singular : l.plural}**` +
			(cur.costCents != null ? `, a **${brl(cur.costCents)}** cada.` : '.')
	);

	if (prev.results > 0 && changes.results != null) {
		const same = Math.abs(changes.results) < 1;
		const dir = changes.results >= 0 ? 'mais' : 'menos';
		const resultsPart = same
			? 'o mesmo número de resultados'
			: `${pct(Math.abs(changes.results), 0)} ${dir} resultados`;
		const costPart =
			changes.cost != null
				? `, com custo por resultado ${changes.cost <= 0 ? 'menor' : 'maior'} (${signedPct(changes.cost, 0)}).`
				: '.';
		parts.push(
			`No período anterior foram ${int(prev.results)} ${prev.results === 1 ? l.singular : l.plural}` +
				(prev.costCents != null ? ` a ${brl(prev.costCents)} cada` : '') +
				`. Ou seja, ${resultsPart}${costPart}`
		);
	}

	if (cur.reach != null) parts.push(`Os anúncios chegaram a ${int(cur.reach)} pessoas diferentes.`);

	if (facts.pacing) {
		parts.push(
			`No mês, já foram ${brl(facts.pacing.spentCents)} de ${brl(facts.pacing.monthlyBudgetCents)} planejados. No ritmo atual o mês fecha perto de ${brl(facts.pacing.projectedCents)}.`
		);
	}

	if (facts.bestAds[0]) {
		const b = facts.bestAds[0];
		parts.push(
			`O anúncio com melhor resultado foi **${b.name}**, com ${int(b.results)} ${b.results === 1 ? l.singular : l.plural}` +
				(b.costCents != null ? ` a ${brl(b.costCents)} cada.` : '.')
		);
	}

	if (facts.feedback?.sales) {
		parts.push(
			`Você nos informou que ${int(facts.feedback.sales)} contatos viraram cliente. Isso dá cerca de **${brl(Math.round(cur.spendCents / facts.feedback.sales))}** de investimento por cliente.`
		);
	}

	const actions = clientActions(facts);
	let text = parts.join('\n\n');
	if (actions.length)
		text += `\n\n**Próximos passos**\n${actions.map((a) => `- ${a.charAt(0).toUpperCase()}${a.slice(1)}.`).join('\n')}`;
	return cleanText(text);
}

/** @param {ReportFacts} facts */
export function templateInternalAnalysis(facts) {
	const l = RESULT_LABELS[facts.resultType] ?? RESULT_LABELS.LEAD_FORM;
	const { cur, prev, changes } = facts;
	const lines = [];
	lines.push(`## Resumo`);
	lines.push(
		`- Investimento: ${brl(cur.spendCents)} (${changes.spend != null ? signedPct(changes.spend, 0) : 'sem comparação'} vs período anterior, ${brl(prev.spendCents)})`
	);
	lines.push(
		`- ${l.title}: ${int(cur.results)} (${changes.results != null ? signedPct(changes.results, 0) : 'sem comparação'}, antes ${int(prev.results)})`
	);
	lines.push(
		`- ${l.cost}: ${cur.costCents != null ? brl(cur.costCents) : '-'} (${changes.cost != null ? signedPct(changes.cost, 0) : 'sem comparação'}, antes ${prev.costCents != null ? brl(prev.costCents) : '-'})` +
			(facts.targetCostCents ? `, alvo ${brl(facts.targetCostCents)}` : '')
	);
	if (cur.frequency != null)
		lines.push(
			`- Frequência ${decimal(cur.frequency)}, alcance ${cur.reach != null ? int(cur.reach) : '-'}, CTR do link ${cur.ctr != null ? pct(cur.ctr, 2) : '-'}, CPM ${cur.cpmCents != null ? brl(cur.cpmCents) : '-'}`
		);
	if (cur.depthRate != null)
		lines.push(
			`- Profundidade da conversa: ${pct(cur.depthRate, 0)} dos resultados mandam 2+ mensagens`
		);

	lines.push('', '## Campanhas');
	for (const c of facts.campaigns.slice(0, 6)) {
		lines.push(
			`- ${c.name}: ${brl(c.spendCents)}, ${int(c.results)} resultados${c.costCents != null ? `, ${brl(c.costCents)} cada` : ''}`
		);
	}

	if (facts.bestAds.length) {
		lines.push('', '## Melhores anúncios');
		for (const a of facts.bestAds)
			lines.push(
				`- ${a.name}: ${brl(a.spendCents)}, ${int(a.results)} resultados, ${a.costCents != null ? brl(a.costCents) : '-'} cada`
			);
	}
	if (facts.worstAds.length) {
		lines.push('', '## Piores anúncios');
		for (const a of facts.worstAds)
			lines.push(
				`- ${a.name}: ${brl(a.spendCents)}, ${int(a.results)} resultados${a.costCents != null ? `, ${brl(a.costCents)} cada` : ' (sem resultado)'}`
			);
	}

	const order = { RED: 'Atenção', YELLOW: 'Observar', GREEN: 'Oportunidade' };
	if (facts.alerts.length) {
		lines.push('', '## Alertas');
		for (const a of facts.alerts)
			lines.push(`- ${order[a.severity] ?? a.severity}: ${a.title}. ${a.detail}`);
	}
	return cleanText(lines.join('\n'));
}

/** Recomendações em regras simples, na ordem de urgência. */
export function templateRecommendations(facts) {
	const recs = [];
	for (const a of facts.alerts) {
		if (a.kind === 'NO_RESULT_SPEND')
			recs.push({ priority: 'alta', action: `Pausar ou trocar: ${a.title}`, reason: a.detail });
		else if (a.kind === 'ENTITY_ISSUES')
			recs.push({ priority: 'alta', action: a.title, reason: a.detail });
		else if (a.kind === 'DEPTH_DROP')
			recs.push({
				priority: 'alta',
				action: 'Conferir no CRM a qualidade dos leads recentes',
				reason: a.detail
			});
		else if (a.kind === 'FREQUENCY_HIGH')
			recs.push({
				priority: 'media',
				action: `Renovar criativo ou ampliar público: ${a.entityName ?? ''}`.trim(),
				reason: a.detail
			});
		else if (a.kind === 'COST_RISING')
			recs.push({
				priority: 'media',
				action: 'Investigar a alta do custo por resultado',
				reason: a.detail
			});
		else if (a.kind === 'OPPORTUNITY')
			recs.push({
				priority: 'media',
				action: `Dar mais verba: ${a.entityName ?? ''}`.trim(),
				reason: a.detail
			});
		else if (a.kind === 'BUDGET_PACING')
			recs.push({
				priority: 'media',
				action: 'Ajustar o ritmo do orçamento do mês',
				reason: a.detail
			});
	}
	if (!facts.feedback?.sales) {
		recs.push({
			priority: 'media',
			action: 'Pedir ao cliente quantos contatos viraram venda',
			reason: 'Sem esse dado só temos o custo por resultado, não o custo por cliente.'
		});
	}
	return recs.slice(0, 8);
}

/** @param {ReportFacts} facts */
export function templateReport(facts) {
	return {
		title: `Relatório ${fullBR(facts.since).slice(0, 5)} a ${fullBR(facts.until)}`,
		clientSummary: templateClientSummary(facts),
		internalAnalysis: templateInternalAnalysis(facts),
		recommendations: templateRecommendations(facts)
	};
}
