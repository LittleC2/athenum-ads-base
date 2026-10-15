import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { OBJECTIVES, SpecSchema, totalDailyBudgetCents } from '$lib/campaignSpec.js';

export const load = async ({ locals }) => {
	requireAdmin(locals);
	const drafts = await db.campaignDraft.findMany({
		orderBy: { updatedAt: 'desc' },
		take: 60,
		include: { client: { select: { name: true } } }
	});
	return {
		drafts: drafts.map((d) => {
			const spec = SpecSchema.safeParse(d.spec);
			return {
				id: d.id,
				name: d.name,
				clientName: d.client.name,
				objective: OBJECTIVES[d.objective].label,
				status: d.status,
				dailyBudgetCents: spec.success ? totalDailyBudgetCents(spec.data) : 0,
				updatedAt: d.updatedAt
			};
		})
	};
};
