import { error } from '@sveltejs/kit';
import { requireClientUser } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { loadDashboardForPeriod } from '$lib/server/dashboard.js';
import { customPeriod, fromDbDate } from '$lib/dates.js';

export const load = async ({ locals, params }) => {
	const user = requireClientUser(locals);
	// Filtra por clientId da sessão: relatório de outro cliente responde 404.
	const report = await db.report.findFirst({
		where: { id: params.id, clientId: user.clientId, status: 'PUBLISHED' },
		include: { account: true, client: { select: { name: true } } }
	});
	if (!report) throw error(404, 'Relatório não encontrado.');

	const since = fromDbDate(report.periodStart);
	const until = fromDbDate(report.periodEnd);
	// Gráficos e anúncios saem do período do relatório, nos mesmos dados do painel.
	const dashboard =
		report.account && report.account.clientId === user.clientId
			? await loadDashboardForPeriod(report.account, customPeriod(since, until))
			: null;

	return {
		report: {
			id: report.id,
			title: report.title,
			periodStart: since,
			periodEnd: until,
			clientSummary: report.clientSummary,
			kpis: report.kpis,
			resultType: report.account?.resultType ?? null
		},
		clientName: report.client.name,
		dashboard
	};
};
