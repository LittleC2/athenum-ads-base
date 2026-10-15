// Cópia standalone do hashPassword de src/lib/server/auth.js, sem depender
// dos módulos virtuais do SvelteKit ($env/...): o seed roda sob `node` puro.
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
	const salt = randomBytes(16).toString('hex');
	const derived = await scrypt(password, salt, 64);
	return `${salt}:${derived.toString('hex')}`;
}
