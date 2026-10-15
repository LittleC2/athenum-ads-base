// Regras de métrica: qual ação da Meta é "resultado" em cada tipo de conta,
// como transformar uma linha de insights da Meta em números do dashboard e
// como comparar períodos. Módulo puro (sem banco, sem rede).

export const ACTION_FOR_RESULT = {
	LEAD_FORM: 'lead',
	WHATSAPP: 'onsite_conversion.messaging_conversation_started_7d',
	PURCHASE: 'omni_purchase',
	LINK_CLICK: 'link_click'
};

const MSG_STARTED = 'onsite_conversion.messaging_conversation_started_7d';
const MSG_DEPTH2 = 'onsite_conversion.messaging_user_depth_2_message_send';

/** Textos pro cliente, sem jargão. */
export const RESULT_LABELS = {
	LEAD_FORM: {
		singular: 'lead',
		plural: 'leads',
		title: 'Leads',
		cost: 'Custo por lead',
		clientHint: 'pessoas que preencheram o formulário'
	},
	WHATSAPP: {
		singular: 'conversa no WhatsApp',
		plural: 'conversas no WhatsApp',
		title: 'Conversas no WhatsApp',
		cost: 'Custo por conversa',
		clientHint: 'pessoas que chamaram no WhatsApp'
	},
	PURCHASE: {
		singular: 'compra',
		plural: 'compras',
		title: 'Compras',
		cost: 'Custo por compra',
		clientHint: 'compras feitas pelo anúncio'
	},
	LINK_CLICK: {
		singular: 'clique no link',
		plural: 'cliques no link',
		title: 'Cliques no link',
		cost: 'Custo por clique',
		clientHint: 'pessoas que clicaram no link do anúncio'
	}
};

export function actionValue(actions, type) {
	const found = (actions ?? []).find((a) => a.action_type === type);
	return found ? Number(found.value) : 0;
}

/**
 * Linha de insights da Meta -> números normalizados (dinheiro em centavos).
 * @param {object} row linha da API (spend, impressions, clicks, inline_link_clicks, actions)
 * @param {keyof typeof ACTION_FOR_RESULT} resultType
 */
export function normalizeRow(row, resultType) {
	const actions = row.actions ?? [];
	const actionMap = Object.fromEntries(actions.map((a) => [a.action_type, Number(a.value)]));
	const resultAction = ACTION_FOR_RESULT[resultType] ?? 'lead';
	let results = actionMap[resultAction] ?? 0;
	if (resultType === 'PURCHASE' && !results) results = actionMap.purchase ?? 0;
	return {
		spendCents: Math.round(Number(row.spend ?? 0) * 100),
		impressions: Number(row.impressions ?? 0),
		clicks: Number(row.clicks ?? 0),
		linkClicks: Number(row.inline_link_clicks ?? actionMap.link_click ?? 0),
		results,
		conversations: actionMap[MSG_STARTED] ?? 0,
		depth2: actionMap[MSG_DEPTH2] ?? 0,
		actions: actionMap
	};
}

/** Soma uma lista de linhas já normalizadas. */
export function sumRows(rows) {
	const total = {
		spendCents: 0,
		impressions: 0,
		clicks: 0,
		linkClicks: 0,
		results: 0,
		conversations: 0,
		depth2: 0
	};
	for (const r of rows) {
		total.spendCents += r.spendCents ?? 0;
		total.impressions += r.impressions ?? 0;
		total.clicks += r.clicks ?? 0;
		total.linkClicks += r.linkClicks ?? 0;
		total.results += r.results ?? 0;
		total.conversations += r.conversations ?? 0;
		total.depth2 += r.depth2 ?? 0;
	}
	return total;
}

/** Custo por resultado em centavos, ou null sem resultado. */
export function costPerResult(spendCents, results) {
	return results > 0 ? Math.round(spendCents / results) : null;
}

/** Variação percentual de cur sobre prev; null se prev for zero ou ausente. */
export function pctChange(cur, prev) {
	if (prev == null || cur == null || prev === 0) return null;
	return ((cur - prev) / prev) * 100;
}

export function ctr(clicks, impressions) {
	return impressions > 0 ? (clicks / impressions) * 100 : null;
}

export function cpm(spendCents, impressions) {
	return impressions > 0 ? Math.round((spendCents / impressions) * 1000) : null;
}

/** Proporção de leads que mandaram 2+ mensagens depois do contato (%). */
export function depthRate(depth2, results) {
	return results > 0 ? (depth2 / results) * 100 : null;
}

/**
 * Ritmo do orçamento mensal: quanto já foi gasto, projeção do mês e status.
 * @param {{ spentCents: number, monthlyBudgetCents: number|null, dayOfMonth: number, daysInMonth: number }} p
 */
export function budgetPacing({ spentCents, monthlyBudgetCents, dayOfMonth, daysInMonth }) {
	if (!monthlyBudgetCents) return null;
	const projectedCents = Math.round((spentCents / Math.max(dayOfMonth, 1)) * daysInMonth);
	const spentPct = (spentCents / monthlyBudgetCents) * 100;
	const projectedPct = (projectedCents / monthlyBudgetCents) * 100;
	let status = 'no-ritmo';
	if (projectedPct > 105) status = 'acima';
	else if (dayOfMonth >= 10 && projectedPct < 60) status = 'abaixo';
	return { spentCents, monthlyBudgetCents, projectedCents, spentPct, projectedPct, status };
}
