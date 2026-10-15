import { fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';
import { hasAnthropic } from '$lib/server/ai/anthropic.js';
import { planCampaign } from '$lib/server/ai/planner.js';
import { accountHistory } from '$lib/server/ai/history.js';
import { OBJECTIVES, emptySpec } from '$lib/campaignSpec.js';
import { objectivesByGroup } from '$lib/objectives.js';

export const load = async ({ locals, url }) => {
	requireAdmin(locals);
	const accounts = await db.adAccount.findMany({
		where: { active: true },
		orderBy: { name: 'asc' },
		include: { client: { select: { id: true, name: true } } }
	});
	return {
		withAI: hasAnthropic(),
		preferredClient: url.searchParams.get('cliente'),
		objectiveGroups: objectivesByGroup(),
		accounts: accounts.map((a) => ({
			id: a.id,
			name: a.name,
			clientId: a.client.id,
			clientName: a.client.name,
			resultType: a.resultType
		}))
	};
};

export const actions = {
	default: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const account = await db.adAccount.findUnique({
			where: { id: String(form.get('accountId') ?? '') },
			include: { client: true }
		});
		const objective = String(form.get('objective') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!account) return fail(400, { error: 'Escolha a conta.' });
		if (!OBJECTIVES[objective]) return fail(400, { error: 'Escolha o objetivo.' });
		if (name.length < 3) return fail(400, { error: 'Dê um nome à campanha.' });

		let spec = emptySpec(objective, name);
		let plannerNotes = null;

		if (form.get('useAI') === 'on') {
			if (!hasAnthropic())
				return fail(400, { error: 'A IA não está configurada (falta ANTHROPIC_API_KEY).' });
			try {
				const [brief, assets, copies, history] = await Promise.all([
					db.clientBrief.findUnique({ where: { clientId: account.clientId } }),
					db.asset.findMany({
						where: { clientId: account.clientId },
						select: { id: true, name: true, kind: true }
					}),
					db.copyVariant.findMany({
						where: { clientId: account.clientId, status: 'APPROVED' },
						take: 12
					}),
					accountHistory(account)
				]);
				const plan = await planCampaign({
					objective,
					account,
					client: account.client,
					brief,
					instructions: String(form.get('instructions') ?? ''),
					assets,
					copies,
					history,
					name
				});
				spec = plan.spec;
				plannerNotes = plan.rationale;
			} catch (err) {
				return fail(502, { error: `O Claude não conseguiu montar a proposta: ${err.message}` });
			}
		}

		const draft = await db.campaignDraft.create({
			data: {
				clientId: account.clientId,
				accountId: account.id,
				name,
				objective,
				spec,
				plannerNotes,
				createdById: admin.id
			}
		});
		await audit({
			userId: admin.id,
			clientId: account.clientId,
			accountId: account.id,
			action: 'draft.create',
			target: name,
			payload: { ai: Boolean(plannerNotes) }
		});
		throw redirect(303, `/admin/campanhas/${draft.id}`);
	}
};
