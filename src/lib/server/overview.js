// Visão geral do gestor: cada cliente com os números dos últimos 7 dias
// (contra os 7 anteriores), alertas abertos e estado da sincronização.
import { db } from './db.js';
import { addDays, fromDbDate, periodFromPreset, toDbDate, todayInSP } from '../dates.js';
import { costPerResult, pctChange } from '../metrics.js';

async function totals(accountId, since, until) {
	const agg = await db.insightDaily.aggregate({
		where: { accountId, level: 'CAMPAIGN', date: { gte: toDbDate(since), lte: toDbDate(until) } },
		_sum: { spendCents: true, results: true }
	});
	const spendCents = agg._sum.spendCents ?? 0;
	const results = agg._sum.results ?? 0;
	return { spendCents, results, costCents: costPerResult(spendCents, results) };
}

/** Resultados e gasto dia a dia (dias sem dado entram como zero), pra mini-gráfico. */
async function dailySeries(accountId, since, until) {
	const rows = await db.insightDaily.findMany({
		where: { accountId, level: 'CAMPAIGN', date: { gte: toDbDate(since), lte: toDbDate(until) } },
		select: { date: true, results: true, spendCents: true }
	});
	const byDay = new Map();
	for (const r of rows) {
		const key = fromDbDate(r.date);
		const cur = byDay.get(key) ?? { results: 0, spendCents: 0 };
		cur.results += r.results;
		cur.spendCents += r.spendCents;
		byDay.set(key, cur);
	}
	const out = [];
	for (let d = since; d <= until; d = addDays(d, 1))
		out.push(byDay.get(d) ?? { results: 0, spendCents: 0 });
	return out;
}

export async function loadOverview() {
	const today = todayInSP();
	const p = periodFromPreset('7d', today);

	const [clients, alertGroups] = await Promise.all([
		db.client.findMany({
			where: { status: { not: 'ENCERRADO' } },
			orderBy: { name: 'asc' },
			include: { accounts: { where: { active: true }, orderBy: { createdAt: 'asc' } } }
		}),
		db.alert.groupBy({ by: ['accountId', 'severity'], where: { status: 'OPEN' }, _count: true })
	]);

	const alertMap = new Map();
	for (const g of alertGroups) {
		const cur = alertMap.get(g.accountId) ?? { RED: 0, YELLOW: 0, GREEN: 0 };
		cur[g.severity] = g._count;
		alertMap.set(g.accountId, cur);
	}

	const out = [];
	for (const c of clients) {
		const accounts = [];
		for (const a of c.accounts) {
			const [cur, prev, daily] = await Promise.all([
				totals(a.id, p.since, p.until),
				totals(a.id, p.prevSince, p.prevUntil),
				dailySeries(a.id, p.since, p.until)
			]);
			accounts.push({
				id: a.id,
				name: a.name,
				resultType: a.resultType,
				targetCostCents: a.targetCostCents,
				syncedAt: a.syncedAt,
				lastSyncError: a.lastSyncError,
				cur,
				prev,
				costChange: pctChange(cur.costCents, prev.costCents),
				resultsChange: pctChange(cur.results, prev.results),
				spark: daily.map((d) => d.results),
				prevResults: prev.results,
				alerts: alertMap.get(a.id) ?? { RED: 0, YELLOW: 0, GREEN: 0 }
			});
		}
		out.push({ id: c.id, name: c.name, segment: c.segment, status: c.status, accounts });
	}
	return out;
}
