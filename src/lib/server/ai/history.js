// Resumo do histórico real da conta, que o planejador e o copiloto usam pra
// repetir o que funciona. Lê só do banco (já sincronizado).
import { db } from '../db.js';
import { addDays, toDbDate, todayInSP } from '../../dates.js';
import { brl } from '../../format.js';
import { costPerResult } from '../../metrics.js';

export async function accountHistory(account, days = 60) {
	const since = toDbDate(addDays(todayInSP(), -(days - 1)));
	const rows = await db.insightDaily.findMany({
		where: { accountId: account.id, level: 'AD', date: { gte: since } },
		select: { entityId: true, entityName: true, spendCents: true, results: true }
	});
	const byAd = new Map();
	for (const r of rows) {
		const cur = byAd.get(r.entityId) ?? { name: r.entityName, spendCents: 0, results: 0 };
		cur.spendCents += r.spendCents;
		cur.results += r.results;
		byAd.set(r.entityId, cur);
	}
	const bestAds = [...byAd.values()]
		.filter((a) => a.results >= 3 && a.spendCents >= 1500)
		.map((a) => ({
			name: a.name,
			results: a.results,
			costCents: costPerResult(a.spendCents, a.results)
		}))
		.sort((x, y) => x.costCents - y.costCents)
		.slice(0, 6)
		.map((a) => ({ ...a, cost: `${brl(a.costCents)} por resultado` }));
	return { bestAds, placementHint: null };
}
