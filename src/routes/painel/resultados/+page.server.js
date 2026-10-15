import { fail } from '@sveltejs/kit';
import { clientAccounts, requireClientUser } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { addDays, fromDbDate, monthStart, toDbDate, todayInSP } from '$lib/dates.js';
import { optionalInt, toCents } from '$lib/money.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const load = async ({ locals }) => {
	const user = requireClientUser(locals);
	const accounts = await clientAccounts(locals);
	const feedbacks = await db.resultFeedback.findMany({
		where: { clientId: user.clientId },
		orderBy: { periodStart: 'desc' },
		take: 24
	});

	// Quanto foi investido em cada período informado, pra mostrar o custo por cliente.
	const accountIds = accounts.map((a) => a.id);
	const rows = await Promise.all(
		feedbacks.map(async (f) => {
			const agg = await db.insightDaily.aggregate({
				where: {
					accountId: { in: accountIds },
					level: 'CAMPAIGN',
					date: { gte: f.periodStart, lte: f.periodEnd }
				},
				_sum: { spendCents: true, results: true }
			});
			return {
				id: f.id,
				periodStart: fromDbDate(f.periodStart),
				periodEnd: fromDbDate(f.periodEnd),
				qualified: f.qualified,
				sales: f.sales,
				revenueCents: f.revenueCents,
				note: f.note,
				spendCents: agg._sum.spendCents ?? 0,
				results: agg._sum.results ?? 0
			};
		})
	);

	const today = todayInSP();
	const prevMonthEnd = addDays(monthStart(today), -1);
	return {
		resultType: accounts[0]?.resultType ?? 'LEAD_FORM',
		defaults: { start: monthStart(prevMonthEnd), end: prevMonthEnd },
		feedbacks: rows
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const user = requireClientUser(locals);
		const form = await request.formData();
		const start = String(form.get('start') ?? '');
		const end = String(form.get('end') ?? '');
		if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
			return fail(400, { error: 'Confira as datas do período.' });
		}
		const qualified = optionalInt(form.get('qualified'));
		const sales = optionalInt(form.get('sales'));
		const revenue = toCents(form.get('revenue'));
		if (qualified.error || sales.error || revenue.error) {
			return fail(400, { error: 'Use apenas números nos campos de quantidade e valor.' });
		}
		if (qualified.value == null && sales.value == null && revenue.value == null) {
			return fail(400, { error: 'Preencha pelo menos um dos campos.' });
		}
		const note =
			String(form.get('note') ?? '')
				.trim()
				.slice(0, 500) || null;

		await db.resultFeedback.create({
			data: {
				clientId: user.clientId,
				periodStart: toDbDate(start),
				periodEnd: toDbDate(end),
				qualified: qualified.value,
				sales: sales.value,
				revenueCents: revenue.value,
				note
			}
		});
		return { saved: true };
	}
};
