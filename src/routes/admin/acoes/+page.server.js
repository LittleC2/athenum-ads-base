import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { ACTION_TYPES, SPENDS_MONEY, executeAction, rejectAction } from '$lib/server/actions.js';

export const load = async ({ locals }) => {
	requireAdmin(locals);
	const actions = await db.proposedAction.findMany({ orderBy: [{ createdAt: 'desc' }], take: 80 });
	const clients = await db.client.findMany({ select: { id: true, name: true } });
	const names = new Map(clients.map((c) => [c.id, c.name]));
	const mapped = actions.map((a) => ({
		id: a.id,
		type: a.type,
		typeLabel: ACTION_TYPES[a.type] ?? a.type,
		spendsMoney: SPENDS_MONEY.has(a.type),
		summary: a.summary,
		source: a.source,
		status: a.status,
		clientName: a.clientId ? (names.get(a.clientId) ?? '') : '',
		error: a.error,
		createdAt: a.createdAt
	}));
	return {
		pending: mapped.filter((a) => a.status === 'PENDING'),
		history: mapped.filter((a) => a.status !== 'PENDING')
	};
};

export const actions = {
	aprovar: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const action = await db.proposedAction.findUnique({ where: { id } });
		if (!action) return fail(404, { error: 'Ação não encontrada.' });
		if (SPENDS_MONEY.has(action.type) && form.get('confirm') !== 'on') {
			return fail(400, { error: 'Esta ação mexe em gasto. Marque a confirmação para aprovar.' });
		}
		try {
			await executeAction(id, admin.id);
			return { ok: 'Ação executada.' };
		} catch (err) {
			return fail(502, { error: err.message });
		}
	},

	rejeitar: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		try {
			await rejectAction(id, admin.id);
			return { ok: 'Ação rejeitada.' };
		} catch (err) {
			return fail(400, { error: err.message });
		}
	}
};
