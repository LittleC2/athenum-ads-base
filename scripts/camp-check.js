import { db } from '../src/lib/server/db.js';
import { toDbDate } from '../src/lib/dates.js';
import { brl } from '../src/lib/format.js';
const [act, since, until] = process.argv.slice(2);
const account = await db.adAccount.findUnique({ where: { externalId: act } });
const rows = await db.insightDaily.findMany({
	where: {
		accountId: account.id,
		level: 'CAMPAIGN',
		date: { gte: toDbDate(since), lte: toDbDate(until) }
	}
});
const by = {};
for (const r of rows) {
	by[r.entityName] ??= { spend: 0, results: 0 };
	by[r.entityName].spend += r.spendCents;
	by[r.entityName].results += r.results;
}
let S = 0,
	R = 0;
for (const [n, v] of Object.entries(by).sort((a, b) => b[1].spend - a[1].spend)) {
	S += v.spend;
	R += v.results;
	console.log(brl(v.spend).padStart(14), String(v.results).padStart(5), n);
}
console.log('TOTAL', brl(S), R);
await db.$disconnect();
