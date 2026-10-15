// Monta os dados do dashboard de uma conta pra um período. Serve o painel do
// cliente e a visão interna do gestor (o gestor vê mais campos, mas parte
// da mesma fonte, então os números nunca divergem).
import { db } from './db.js';
import {
	addDays,
	daysInMonth,
	diffDays,
	fromDbDate,
	monthStart,
	periodFromPreset,
	todayInSP,
	toDbDate
} from '../dates.js';
import {
	budgetPacing,
	costPerResult,
	cpm,
	ctr,
	depthRate,
	normalizeRow,
	pctChange,
	sumRows
} from '../metrics.js';
import { liveInsights } from './meta/insights.js';
import { activityOf, bestDay, costSeries, funnelOf, healthOf, seriesOf } from '../story.js';

const toRow = (r) => ({
	date: fromDbDate(r.date),
	entityId: r.entityId,
	entityName: r.entityName,
	campaignId: r.campaignId,
	adsetId: r.adsetId,
	spendCents: r.spendCents,
	impressions: r.impressions,
	clicks: r.clicks,
	linkClicks: r.linkClicks,
	results: r.results,
	conversations: r.conversations,
	depth2: r.depth2
});

async function rowsIn(accountId, level, since, until) {
	const rows = await db.insightDaily.findMany({
		where: { accountId, level, date: { gte: toDbDate(since), lte: toDbDate(until) } },
		orderBy: { date: 'asc' }
	});
	return rows.map(toRow);
}

function kpis(rows) {
	const t = sumRows(rows);
	return {
		...t,
		costCents: costPerResult(t.spendCents, t.results),
		ctr: ctr(t.linkClicks || t.clicks, t.impressions),
		cpmCents: cpm(t.spendCents, t.impressions),
		depthRate: depthRate(t.depth2, t.results)
	};
}

function groupSum(rows, keyFn) {
	const map = new Map();
	for (const r of rows) {
		const key = keyFn(r);
		const cur = map.get(key.id) ?? { id: key.id, name: key.name, rows: [] };
		cur.rows.push(r);
		map.set(key.id, cur);
	}
	return [...map.values()].map((g) => {
		const t = kpis(g.rows);
		return { id: g.id, name: g.name, ...t };
	});
}

/**
 * @param {import('../../generated/prisma/client.ts').AdAccount} account
 * @param {string} preset 7d | 30d | month | lastmonth
 */
export async function loadDashboard(account, preset) {
	return loadDashboardForPeriod(account, periodFromPreset(preset, todayInSP()));
}

/** Igual a loadDashboard, mas pra um período qualquer ({ since, until, prevSince, prevUntil, label }). */
export async function loadDashboardForPeriod(account, period) {
	const today = todayInSP();

	const [curCamp, prevCamp, curAd, entityRows] = await Promise.all([
		rowsIn(account.id, 'CAMPAIGN', period.since, period.until),
		rowsIn(account.id, 'CAMPAIGN', period.prevSince, period.prevUntil),
		rowsIn(account.id, 'AD', period.since, period.until),
		db.metaEntity.findMany({ where: { accountId: account.id } })
	]);

	const entityStatus = new Map(entityRows.map((e) => [e.externalId, e]));
	const cur = kpis(curCamp);
	const prev = kpis(prevCamp);

	// Alcance e frequência exatos vêm da Meta (não somam entre dias).
	let reach = null;
	let frequency = null;
	try {
		const live = await liveInsights(account, { since: period.since, until: period.until });
		if (live[0]) {
			reach = Number(live[0].reach ?? 0);
			frequency = Number(live[0].frequency ?? 0);
		}
	} catch {
		// Sem alcance ao vivo: o resto do painel continua valendo.
	}

	// Série diária completa (dias sem gasto entram como zero).
	const byDay = new Map();
	for (const r of curCamp) {
		const d = byDay.get(r.date) ?? { spendCents: 0, results: 0 };
		d.spendCents += r.spendCents;
		d.results += r.results;
		byDay.set(r.date, d);
	}
	const series = [];
	for (let d = period.since; d <= period.until; d = addDays(d, 1)) {
		series.push({ date: d, ...(byDay.get(d) ?? { spendCents: 0, results: 0 }) });
	}

	const campaigns = groupSum(curCamp, (r) => ({ id: r.entityId, name: r.entityName }))
		.map((c) => ({ ...c, status: entityStatus.get(c.id)?.effectiveStatus ?? null }))
		.sort((a, b) => b.spendCents - a.spendCents);

	const ads = groupSum(curAd, (r) => ({ id: r.entityId, name: r.entityName }))
		.map((a) => {
			const ent = entityStatus.get(a.id);
			return {
				...a,
				status: ent?.effectiveStatus ?? null,
				thumbnailUrl: ent?.thumbnailUrl ?? null
			};
		})
		.sort((a, b) => b.spendCents - a.spendCents);

	// Ritmo do orçamento mensal (sempre do mês corrente, independe do período).
	let pacing = null;
	if (account.monthlyBudgetCents) {
		const mtdRows = await rowsIn(account.id, 'CAMPAIGN', monthStart(today), today);
		pacing = budgetPacing({
			spentCents: sumRows(mtdRows).spendCents,
			monthlyBudgetCents: account.monthlyBudgetCents,
			dayOfMonth: Number(today.slice(8, 10)),
			daysInMonth: daysInMonth(today)
		});
	}

	const dashboard = {
		period,
		today,
		cur: { ...cur, reach, frequency },
		prev,
		changes: {
			spend: pctChange(cur.spendCents, prev.spendCents),
			results: pctChange(cur.results, prev.results),
			cost: pctChange(cur.costCents, prev.costCents)
		},
		series,
		campaigns,
		ads,
		pacing
	};

	// Camada "em palavras": saúde, funil, linha do tempo. Vale pro cliente e pro gestor.
	const [feedback, redAlerts, report, lastFeedback] = await Promise.all([
		db.resultFeedback.aggregate({
			where: {
				clientId: account.clientId,
				periodStart: { lte: toDbDate(period.until) },
				periodEnd: { gte: toDbDate(period.since) }
			},
			_sum: { sales: true, qualified: true },
			_count: true
		}),
		db.alert.count({ where: { accountId: account.id, status: 'OPEN', severity: 'RED' } }),
		db.report.findFirst({
			where: { clientId: account.clientId, status: 'PUBLISHED' },
			orderBy: { publishedAt: 'desc' },
			select: { title: true, publishedAt: true }
		}),
		db.resultFeedback.findFirst({
			where: { clientId: account.clientId },
			orderBy: { periodEnd: 'desc' },
			select: { periodEnd: true }
		})
	]);
	const hasFeedback = feedback._count > 0 && feedback._sum.sales != null;
	const feedbackDue =
		cur.results > 0 && (!lastFeedback || diffDays(fromDbDate(lastFeedback.periodEnd), today) > 14);
	const recentReport =
		report?.publishedAt && diffDays(report.publishedAt.toISOString().slice(0, 10), today) <= 7
			? report
			: null;
	const story = {
		health: healthOf({ account, dashboard, redAlerts }),
		funnel: funnelOf({
			account,
			dashboard,
			feedback: hasFeedback ? { sales: feedback._sum.sales } : null
		}),
		best: bestDay(series),
		sparks: {
			spend: seriesOf(series, 'spendCents'),
			results: seriesOf(series, 'results'),
			cost: costSeries(series)
		},
		activity: activityOf({ account, dashboard, report: recentReport, feedbackDue }),
		syncedAt: account.syncedAt
	};
	return { ...dashboard, story };
}

/** Quebras ao vivo (só visão do gestor): idade/gênero e posicionamento. */
export async function loadBreakdowns(account, preset) {
	const period = periodFromPreset(preset);
	const [age, placement] = await Promise.all([
		liveInsights(account, { ...period, breakdowns: 'age,gender' }).catch(() => []),
		liveInsights(account, { ...period, breakdowns: 'publisher_platform,platform_position' }).catch(
			() => []
		)
	]);
	return { age, placement };
}

/** Alertas abertos da conta. O cliente só recebe os marcados como visíveis, com texto simples. */
export async function loadAlerts(accountId, { forClient }) {
	const alerts = await db.alert.findMany({
		where: { accountId, status: 'OPEN', ...(forClient ? { visibleToClient: true } : {}) },
		orderBy: [{ severity: 'asc' }, { lastSeenAt: 'desc' }]
	});
	return alerts.map((a) =>
		forClient
			? {
					id: a.id,
					severity: a.severity,
					title: a.clientTitle ?? a.title,
					detail: a.clientDetail ?? ''
				}
			: {
					id: a.id,
					severity: a.severity,
					kind: a.kind,
					title: a.title,
					detail: a.detail,
					entityName: a.entityName,
					firstSeenAt: a.firstSeenAt
				}
	);
}

/**
 * Agrupa linhas de quebra ao vivo (idade/gênero, posicionamento) em tabela
 * ordenada por gasto, com custo por resultado.
 */
export function summarizeBreakdown(rows, resultType, keyFn) {
	const map = new Map();
	for (const row of rows) {
		const key = keyFn(row);
		const n = normalizeRow(row, resultType);
		const cur = map.get(key) ?? { key, spendCents: 0, results: 0, impressions: 0 };
		cur.spendCents += n.spendCents;
		cur.results += n.results;
		cur.impressions += n.impressions;
		map.set(key, cur);
	}
	const total = [...map.values()].reduce((s, r) => s + r.spendCents, 0);
	return [...map.values()]
		.map((r) => ({
			...r,
			costCents: costPerResult(r.spendCents, r.results),
			share: total ? (r.spendCents / total) * 100 : 0
		}))
		.sort((a, b) => b.spendCents - a.spendCents);
}
