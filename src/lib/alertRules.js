// Regras de alerta de uma conta. Módulo puro: recebe os números já lidos do
// banco e devolve a lista de alertas que estão valendo agora. Os limiares
// vêm da skill relatorio-ads (frequência, custo subindo) e do que aprendemos
// nas contas reais (queda de profundidade de conversa, CPM disparando).
import { addDays, daysInMonth } from './dates.js';
import { brl, decimal, pct } from './format.js';
import { RESULT_LABELS, budgetPacing, costPerResult, depthRate, pctChange } from './metrics.js';

/**
 * @typedef {{ date: string, entityId: string, entityName: string, spendCents: number,
 *   impressions: number, results: number, depth2: number, conversations: number }} DayRow
 */

function inRange(rows, since, until) {
	return rows.filter((r) => r.date >= since && r.date <= until);
}

function totals(rows) {
	let spendCents = 0;
	let impressions = 0;
	let results = 0;
	let depth2 = 0;
	for (const r of rows) {
		spendCents += r.spendCents;
		impressions += r.impressions;
		results += r.results;
		depth2 += r.depth2;
	}
	return { spendCents, impressions, results, depth2 };
}

function groupBy(rows, key) {
	const map = new Map();
	for (const r of rows) {
		const k = r[key];
		if (!map.has(k)) map.set(k, []);
		map.get(k).push(r);
	}
	return map;
}

/**
 * @param {{
 *  account: { resultType: string, targetCostCents: number|null, monthlyBudgetCents: number|null },
 *  today: string,
 *  campaignDaily: DayRow[],
 *  adDaily: DayRow[],
 *  entities: Map<string, { effectiveStatus: string|null, name: string }>,
 *  liveFreq?: { campaignId: string, name: string, frequency: number, spendCents: number }[]
 * }} input
 */
export function evaluateAlerts({
	account,
	today,
	campaignDaily,
	adDaily,
	entities,
	liveFreq = []
}) {
	const label = RESULT_LABELS[account.resultType] ?? RESULT_LABELS.LEAD_FORM;
	const alerts = [];

	const cur7 = totals(inRange(campaignDaily, addDays(today, -6), today));
	const prev7 = totals(inRange(campaignDaily, addDays(today, -13), addDays(today, -7)));
	const cpr7 = costPerResult(cur7.spendCents, cur7.results);
	const cprPrev = costPerResult(prev7.spendCents, prev7.results);

	// 1. Custo por resultado subindo
	const change = pctChange(cpr7, cprPrev);
	if (change != null && prev7.results >= 8 && cur7.results >= 5 && change >= 30) {
		alerts.push({
			kind: 'COST_RISING',
			severity: change >= 60 ? 'RED' : 'YELLOW',
			title: `${label.cost} subiu ${pct(change, 0)} na semana`,
			detail: `Últimos 7 dias: ${brl(cpr7)} (${cur7.results} ${label.plural}). Semana anterior: ${brl(cprPrev)} (${prev7.results}).`,
			visibleToClient: true,
			clientTitle: `${label.cost} subiu um pouco esta semana`,
			clientDetail: `Cada ${label.singular} custou ${brl(cpr7)}, contra ${brl(cprPrev)} na semana anterior. Estamos ajustando os anúncios.`
		});
	}

	// 2. Acima do custo alvo
	if (
		account.targetCostCents &&
		cpr7 &&
		cur7.results >= 5 &&
		cpr7 > account.targetCostCents * 1.3
	) {
		alerts.push({
			kind: 'COST_ABOVE_TARGET',
			severity: 'YELLOW',
			title: `${label.cost} acima do alvo`,
			detail: `${brl(cpr7)} nos últimos 7 dias, alvo ${brl(account.targetCostCents)}.`,
			visibleToClient: false
		});
	}

	// 3. Anúncio ativo gastando sem resultado
	const threshold = Math.max(4000, (account.targetCostCents ?? 0) * 3);
	const ad14 = inRange(adDaily, addDays(today, -13), today);
	for (const [adId, rows] of groupBy(ad14, 'entityId')) {
		const t = totals(rows);
		const status = entities.get(adId)?.effectiveStatus;
		if (status === 'ACTIVE' && t.results === 0 && t.spendCents >= threshold) {
			alerts.push({
				kind: 'NO_RESULT_SPEND',
				severity: 'RED',
				entityId: adId,
				entityName: rows[0].entityName,
				title: `Anúncio gastou ${brl(t.spendCents)} sem resultado`,
				detail: `"${rows[0].entityName}" em 14 dias, 0 ${label.plural}. Pausar ou trocar.`,
				visibleToClient: false
			});
		}
	}

	// 4. Frequência alta (público saturando)
	for (const c of liveFreq) {
		if (c.frequency > 3 && c.spendCents >= 5000) {
			alerts.push({
				kind: 'FREQUENCY_HIGH',
				severity: c.frequency > 4 ? 'RED' : 'YELLOW',
				entityId: c.campaignId,
				entityName: c.name,
				title: `Frequência ${decimal(c.frequency)} em "${c.name}"`,
				detail:
					'A mesma pessoa está vendo o anúncio muitas vezes. Renovar criativo ou ampliar o público.',
				visibleToClient: false
			});
		}
	}

	// 5. Ritmo do orçamento mensal
	if (account.monthlyBudgetCents) {
		const monthStart = `${today.slice(0, 7)}-01`;
		const mtd = totals(inRange(campaignDaily, monthStart, today));
		const pacing = budgetPacing({
			spentCents: mtd.spendCents,
			monthlyBudgetCents: account.monthlyBudgetCents,
			dayOfMonth: Number(today.slice(8, 10)),
			daysInMonth: daysInMonth(today)
		});
		if (pacing && pacing.status === 'acima') {
			alerts.push({
				kind: 'BUDGET_PACING',
				severity: 'YELLOW',
				title: 'Investimento do mês acima do planejado',
				detail: `Gasto ${brl(pacing.spentCents)} de ${brl(pacing.monthlyBudgetCents)}; projeção do mês ${brl(pacing.projectedCents)}.`,
				visibleToClient: true,
				clientTitle: 'O investimento do mês está acima do planejado',
				clientDetail: `Já foram ${brl(pacing.spentCents)} de ${brl(pacing.monthlyBudgetCents)}. No ritmo atual o mês fecha perto de ${brl(pacing.projectedCents)}.`
			});
		} else if (pacing && pacing.status === 'abaixo') {
			alerts.push({
				kind: 'BUDGET_PACING',
				severity: 'YELLOW',
				title: 'Investimento do mês abaixo do planejado',
				detail: `Gasto ${brl(pacing.spentCents)} de ${brl(pacing.monthlyBudgetCents)}; projeção do mês ${brl(pacing.projectedCents)}.`,
				visibleToClient: false
			});
		}
	}

	// 6. Campanha ativa sem entrega
	const yesterday = addDays(today, -1);
	const dayBefore = addDays(today, -2);
	for (const [campId, ent] of entities) {
		if (ent.level !== 'CAMPAIGN' || ent.effectiveStatus !== 'ACTIVE') continue;
		const recent = campaignDaily.filter(
			(r) => r.entityId === campId && (r.date === yesterday || r.date === dayBefore)
		);
		const spent = recent.reduce((s, r) => s + r.spendCents, 0);
		const hasHistory = campaignDaily.some((r) => r.entityId === campId && r.date < dayBefore);
		if (hasHistory && spent === 0) {
			alerts.push({
				kind: 'DELIVERY_STOPPED',
				severity: 'YELLOW',
				entityId: campId,
				entityName: ent.name,
				title: `Campanha ativa sem entrega: "${ent.name}"`,
				detail:
					'Sem gasto nos últimos 2 dias. Pode estar em análise, com orçamento zerado ou público esgotado.',
				visibleToClient: false
			});
		}
	}

	// 7. Anúncio reprovado ou com problema
	for (const [id, ent] of entities) {
		if (ent.level === 'AD' && ['DISAPPROVED', 'WITH_ISSUES'].includes(ent.effectiveStatus ?? '')) {
			alerts.push({
				kind: 'ENTITY_ISSUES',
				severity: 'RED',
				entityId: id,
				entityName: ent.name,
				title: `Anúncio com problema: "${ent.name}"`,
				detail: `Status ${ent.effectiveStatus}. Ver motivo no Gerenciador de Anúncios.`,
				visibleToClient: false
			});
		}
	}

	// 8. Queda na profundidade da conversa (qualidade do lead)
	if (['LEAD_FORM', 'WHATSAPP'].includes(account.resultType)) {
		const last14 = totals(inRange(campaignDaily, addDays(today, -13), today));
		const prior60 = totals(inRange(campaignDaily, addDays(today, -73), addDays(today, -14)));
		const rateNow = depthRate(last14.depth2, last14.results);
		const ratePrior = depthRate(prior60.depth2, prior60.results);
		if (
			ratePrior != null &&
			ratePrior >= 8 &&
			rateNow != null &&
			last14.results >= 15 &&
			rateNow < ratePrior * 0.4
		) {
			alerts.push({
				kind: 'DEPTH_DROP',
				severity: 'RED',
				title: 'Leads mandam menos mensagens depois do contato',
				detail: `Só ${pct(rateNow)} dos ${label.plural} mandam 2+ mensagens (eram ${pct(ratePrior)}). Pode ser queda de qualidade do lead ou mudança de rastreio. Conferir no CRM.`,
				visibleToClient: false
			});
		}
	}

	// 9. CPM disparando
	const cpmNow = cur7.impressions ? (cur7.spendCents / cur7.impressions) * 1000 : null;
	const cpmPrev = prev7.impressions ? (prev7.spendCents / prev7.impressions) * 1000 : null;
	const cpmChange = pctChange(cpmNow, cpmPrev);
	if (cpmChange != null && cpmChange >= 40 && cur7.spendCents >= 5000) {
		alerts.push({
			kind: 'CPM_SPIKE',
			severity: 'YELLOW',
			title: `CPM subiu ${pct(cpmChange, 0)}`,
			detail: `${brl(Math.round(cpmNow))} por mil impressões, contra ${brl(Math.round(cpmPrev))} na semana anterior. Leilão mais caro ou criativo cansado.`,
			visibleToClient: false
		});
	}

	// 10. Oportunidade: anúncio bem melhor que a média com pouca verba
	if (cpr7 != null) {
		const ad14Groups = groupBy(ad14, 'entityId');
		const spend14 = totals(ad14).spendCents;
		for (const [adId, rows] of ad14Groups) {
			const t = totals(rows);
			const cpr = costPerResult(t.spendCents, t.results);
			if (
				entities.get(adId)?.effectiveStatus === 'ACTIVE' &&
				t.results >= 8 &&
				cpr != null &&
				cpr <= cpr7 * 0.7 &&
				spend14 > 0 &&
				t.spendCents / spend14 < 0.15
			) {
				alerts.push({
					kind: 'OPPORTUNITY',
					severity: 'GREEN',
					entityId: adId,
					entityName: rows[0].entityName,
					title: `Oportunidade: "${rows[0].entityName}"`,
					detail: `${brl(cpr)} por ${label.singular} (média ${brl(cpr7)}) com só ${pct((t.spendCents / spend14) * 100, 0)} da verba. Considerar dar mais verba.`,
					visibleToClient: false
				});
			}
		}
	}

	const order = { RED: 0, YELLOW: 1, GREEN: 2 };
	return alerts
		.map((a) => ({ entityId: '', entityName: null, ...a }))
		.sort((a, b) => order[a.severity] - order[b.severity]);
}
