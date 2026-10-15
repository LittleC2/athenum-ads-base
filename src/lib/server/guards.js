// Guardas de acesso. O isolamento entre clientes depende de TODA query do
// portal passar por aqui: o clientId vem da sessão, nunca de parâmetro da URL.
import { error } from '@sveltejs/kit';
import { db } from './db.js';

export function requireAdmin(locals) {
	if (locals.user?.role !== 'ADMIN') throw error(403, 'Acesso restrito ao gestor.');
	return locals.user;
}

export function requireClientUser(locals) {
	const user = locals.user;
	if (user?.role !== 'CLIENT' || !user.clientId) throw error(403, 'Acesso restrito ao cliente.');
	return user;
}

/** Contas de anúncios do cliente logado (só as dele). */
export async function clientAccounts(locals) {
	const user = requireClientUser(locals);
	return db.adAccount.findMany({
		where: { clientId: user.clientId, active: true },
		orderBy: { createdAt: 'asc' }
	});
}

/**
 * Conta do cliente logado. Se a conta pedida não for dele, responde 404 (não
 * 403, pra não confirmar que a conta existe).
 */
export async function clientAccountOr404(locals, accountId) {
	const accounts = await clientAccounts(locals);
	const account = accountId ? accounts.find((a) => a.id === accountId) : accounts[0];
	if (!account) throw error(404, 'Conta não encontrada.');
	return { account, accounts };
}
