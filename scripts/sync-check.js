// Sincroniza uma conta e confere os totais com valores conhecidos.
// Uso: npx vite-node --config vitest.config.js scripts/sync-check.js <act_id> <since> <until>
import { db } from '../src/lib/server/db.js';
import { syncAccount } from '../src/lib/server/sync.js';
import { toDbDate } from '../src/lib/dates.js';
import { brl } from '../src/lib/format.js';

const [act, since, until] = process.argv.slice(2);
const account = await db.adAccount.findUnique({ where: { externalId: act } });
if (!account) throw new Error('Conta não cadastrada: ' + act);

const t0 = Date.now();
const summary = await syncAccount(account.id, { fullBackfill: true });
console.log('sync', JSON.stringify(summary), `${((Date.now() - t0) / 1000).toFixed(1)}s`);

const rows = await db.insightDaily.findMany({
	where: {
		accountId: account.id,
		level: 'CAMPAIGN',
		date: { gte: toDbDate(since), lte: toDbDate(until) }
	}
});
const tot = rows.reduce(
	(a, r) => ({
		spend: a.spend + r.spendCents,
		results: a.results + r.results,
		conv: a.conv + r.conversations
	}),
	{ spend: 0, results: 0, conv: 0 }
);
console.log(
	`${act} ${since}..${until}: gasto ${brl(tot.spend)} | resultados (${account.resultType}) ${tot.results} | conversas ${tot.conv}`
);
const alerts = await db.alert.findMany({
	where: { accountId: account.id, status: 'OPEN' },
	orderBy: { severity: 'asc' }
});
console.log(`alertas abertos: ${alerts.length}`);
for (const a of alerts) console.log(' -', a.severity, a.kind, a.title);
await db.$disconnect();
