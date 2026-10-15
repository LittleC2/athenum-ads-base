import { requireAdmin } from '$lib/server/guards.js';
import { env } from '$env/dynamic/private';
import { portfolioOf } from '$lib/portfolio.js';
import { loadOverview } from '$lib/server/overview.js';
import { getTokenHealth } from '$lib/server/meta/token.js';
import { db } from '$lib/server/db.js';

export const load = async ({ locals }) => {
	requireAdmin(locals);
	const [clients, token, pendingActions, draftsInReview] = await Promise.all([
		loadOverview(),
		getTokenHealth(),
		db.proposedAction.count({ where: { status: 'PENDING' } }),
		db.campaignDraft.count({ where: { status: { in: ['DRAFT', 'REVIEW'] } } })
	]);
	const warning = token.warning ?? token.error ?? null;
	const portfolio = portfolioOf(clients, {
		tokenWarning: warning,
		pendingActions,
		dashboardOnly: env.DASHBOARD_ONLY === '1'
	});
	return {
		portfolio,
		clients,
		pendingActions,
		draftsInReview,
		token: {
			ok: token.ok,
			configured: token.configured,
			warning: token.warning ?? token.error ?? null,
			daysLeft: token.daysLeft ?? null
		}
	};
};
