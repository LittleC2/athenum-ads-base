import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db.js';

export const load = async ({ locals }) => {
	const user = locals.user;
	const dashboardOnly = env.DASHBOARD_ONLY === '1';
	if (!user) return { user: null, dashboardOnly };
	const client = user.clientId
		? await db.client.findUnique({ where: { id: user.clientId }, select: { name: true } })
		: null;
	// Só campos seguros: nada de hash de senha chega ao navegador.
	return {
		dashboardOnly,
		user: { id: user.id, name: user.name, role: user.role, clientName: client?.name ?? null }
	};
};
