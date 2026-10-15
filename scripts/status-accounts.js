import { db } from '../src/lib/server/db.js';
const accs = await db.adAccount.findMany({
	include: { client: true },
	orderBy: { createdAt: 'asc' }
});
for (const a of accs) {
	const agg = await db.insightDaily.aggregate({
		where: { accountId: a.id, level: 'CAMPAIGN' },
		_sum: { spendCents: true, results: true },
		_min: { date: true }
	});
	console.log(
		`${a.client.name.padEnd(26)} ${a.resultType.padEnd(10)} página ${a.pageId ?? '-'} | gasto ${((agg._sum.spendCents ?? 0) / 100).toFixed(2)} | resultados ${agg._sum.results ?? 0} | desde ${agg._min.date?.toISOString().slice(0, 10) ?? '-'} | sync ${a.syncedAt ? 'ok' : 'pendente'}`
	);
}
process.exit(0);
