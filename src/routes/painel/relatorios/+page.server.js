import { requireClientUser } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { fromDbDate } from '$lib/dates.js';

export const load = async ({ locals }) => {
	const user = requireClientUser(locals);
	const reports = await db.report.findMany({
		where: { clientId: user.clientId, status: 'PUBLISHED' },
		orderBy: { periodEnd: 'desc' },
		select: { id: true, title: true, kind: true, periodStart: true, periodEnd: true }
	});
	return {
		reports: reports.map((r) => ({
			...r,
			periodStart: fromDbDate(r.periodStart),
			periodEnd: fromDbDate(r.periodEnd)
		}))
	};
};
