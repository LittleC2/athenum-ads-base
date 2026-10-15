import { db } from './db.js';

/** Registro de tudo que muda dado ou escreve na Meta. Nunca derruba quem chamou. */
export async function audit({
	userId,
	clientId,
	accountId,
	action,
	target,
	payload,
	ok = true,
	error
}) {
	try {
		await db.auditLog.create({
			data: {
				userId: userId ?? null,
				clientId: clientId ?? null,
				accountId: accountId ?? null,
				action,
				target: target ?? null,
				payload: payload ?? undefined,
				ok,
				error: error ? String(error).slice(0, 500) : null
			}
		});
	} catch (err) {
		console.error('[audit] falha ao gravar:', err.message);
	}
}
