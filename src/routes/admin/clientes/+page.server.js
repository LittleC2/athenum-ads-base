import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';

export const load = async ({ locals }) => {
	requireAdmin(locals);
	const clients = await db.client.findMany({
		orderBy: { name: 'asc' },
		include: { accounts: { select: { id: true, name: true } }, users: { select: { id: true } } }
	});
	return {
		clients: clients.map((c) => ({
			id: c.id,
			name: c.name,
			segment: c.segment,
			status: c.status,
			accounts: c.accounts.length,
			logins: c.users.length
		}))
	};
};
