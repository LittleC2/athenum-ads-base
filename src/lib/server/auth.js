// Autenticação própria: sessão = token opaco em cookie httpOnly, guardado na
// tabela Session. Dois papéis: ADMIN (gestor) e CLIENT (portal, só leitura).
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE = 'athenum_ads_session';
const DURATION_MS = { ADMIN: 30 * 24 * 3600 * 1000, CLIENT: 14 * 24 * 3600 * 1000 };
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

export async function hashPassword(password) {
	const salt = randomBytes(16).toString('hex');
	const derived = await scrypt(password, salt, 64);
	return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
	const [salt, hashHex] = stored.split(':');
	if (!salt || !hashHex) return false;
	const derived = await scrypt(password, salt, 64);
	const storedBuf = Buffer.from(hashHex, 'hex');
	if (derived.length !== storedBuf.length) return false;
	return timingSafeEqual(derived, storedBuf);
}

/**
 * Valida e-mail e senha com bloqueio temporário depois de 5 erros seguidos.
 * @returns {Promise<{ user: object } | { error: string }>}
 */
export async function attemptLogin(email, password) {
	const user = await db.user.findUnique({ where: { email } });
	if (user?.lockedUntil && user.lockedUntil > new Date()) {
		return { error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' };
	}
	// Sem usuário, gasta o mesmo tempo de um hash de verdade: a demora não revela se o e-mail existe.
	const valid = user
		? user.active && (await verifyPassword(password, user.passwordHash))
		: (await verifyPassword(password, DUMMY_HASH), false);
	if (!valid) {
		if (user) {
			const failed = user.failedLogins + 1;
			await db.user.update({
				where: { id: user.id },
				data:
					failed >= MAX_FAILED_LOGINS
						? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
						: { failedLogins: failed }
			});
		}
		return { error: 'E-mail ou senha incorretos.' };
	}
	await db.user.update({
		where: { id: user.id },
		data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }
	});
	return { user };
}

export async function createSession(user) {
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + DURATION_MS[user.role]);
	await db.session.create({ data: { token, userId: user.id, expiresAt } });
	return { token, expiresAt };
}

/** Usuário da sessão, ou null se inválida, expirada ou usuário desativado. */
export async function getSessionUser(token) {
	if (!token) return null;
	const session = await db.session.findUnique({ where: { token }, include: { user: true } });
	if (!session) return null;
	if (session.expiresAt < new Date() || !session.user.active) {
		await db.session.delete({ where: { id: session.id } }).catch(() => {});
		return null;
	}
	return session.user;
}

export async function deleteSession(token) {
	if (!token) return;
	await db.session.deleteMany({ where: { token } });
}

/** Encerra todas as sessões de um usuário (troca de senha, desativação). */
export async function deleteUserSessions(userId, exceptToken) {
	await db.session.deleteMany({
		where: { userId, ...(exceptToken ? { token: { not: exceptToken } } : {}) }
	});
}

export function setSessionCookie(cookies, token, expiresAt) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		expires: expiresAt
	});
}

export function clearSessionCookie(cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/** Senha forte o bastante pra um login de cliente gerado pelo gestor. */
export function generatePassword() {
	return randomBytes(9).toString('base64url');
}
