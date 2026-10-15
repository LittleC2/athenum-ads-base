import { clientAccountOr404 } from '$lib/server/guards.js';
import { loadAlerts, loadDashboard } from '$lib/server/dashboard.js';
import { normalizePreset, fromDbDate } from '$lib/dates.js';
import { db } from '$lib/server/db.js';

export const load = async ({ locals, url }) => {
	const { account, accounts } = await clientAccountOr404(locals, url.searchParams.get('conta'));
	const preset = normalizePreset(url.searchParams.get('periodo'));

	const [dashboard, alerts, report] = await Promise.all([
		loadDashboard(account, preset),
		loadAlerts(account.id, { forClient: true }),
		db.report.findFirst({
			where: { clientId: locals.user.clientId, status: 'PUBLISHED' },
			orderBy: { publishedAt: 'desc' }
		})
	]);

	return {
		preset,
		// Só o que o cliente pode ver: nada de custo alvo ou campos internos.
		account: { id: account.id, name: account.name, resultType: account.resultType },
		accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
		dashboard,
		alerts,
		report: report && {
			id: report.id,
			title: report.title,
			periodStart: fromDbDate(report.periodStart),
			periodEnd: fromDbDate(report.periodEnd),
			clientSummary: report.clientSummary
		}
	};
};
