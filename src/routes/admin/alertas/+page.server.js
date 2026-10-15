import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';

export const load = async ({ locals, url }) => {
	requireAdmin(locals);
	const showDismissed = url.searchParams.get('dispensados') === '1';
	const alerts = await db.alert.findMany({
		where: { status: showDismissed ? 'DISMISSED' : 'OPEN' },
		orderBy: [{ severity: 'asc' }, { lastSeenAt: 'desc' }],
		include: { account: { select: { name: true, client: { select: { id: true, name: true } } } } }
	});
	return {
		showDismissed,
		alerts: alerts.map((a) => ({
			id: a.id,
			severity: a.severity,
			title: a.title,
			detail: a.detail,
			kind: a.kind,
			firstSeenAt: a.firstSeenAt,
			visibleToClient: a.visibleToClient,
			clientId: a.account.client.id,
			clientName: a.account.client.name
		}))
	};
};

export const actions = {
	dispensar: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const alert = await db.alert.findUnique({ where: { id }, include: { account: true } });
		if (!alert) return fail(404, { error: 'Alerta não encontrado.' });
		await db.alert.update({ where: { id }, data: { status: 'DISMISSED' } });
		await audit({
			userId: admin.id,
			clientId: alert.account.clientId,
			accountId: alert.accountId,
			action: 'alert.dismiss',
			target: alert.title
		});
		return { ok: true };
	},
	reabrir: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const alert = await db.alert.findUnique({ where: { id } });
		if (!alert) return fail(404, { error: 'Alerta não encontrado.' });
		await db.alert.update({ where: { id }, data: { status: 'OPEN' } });
		await audit({
			userId: admin.id,
			accountId: alert.accountId,
			action: 'alert.reopen',
			target: alert.title
		});
		return { ok: true };
	}
};
