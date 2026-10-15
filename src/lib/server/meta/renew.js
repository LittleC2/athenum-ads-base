// Renovação de token de usuário da Meta (troca por um token de longa duração).
// Precisa de META_APP_ID e META_APP_SECRET no .env, preenchidos pelo próprio gestor.
// O token novo é gravado no .env; nada de segredo é impresso.
import { readFile, writeFile } from 'node:fs/promises';
import { isValidTokenEnv } from '../../tokenEnv.js';
import { graph } from './client.js';

/**
 * @param {{ tokenEnv?: string|null, envFile?: string }} [opts] tokenEnv null = token geral
 * @returns {Promise<{ envName: string, expiresAt: Date|null }>}
 */
export async function renewToken({ tokenEnv = null, envFile = '.env' } = {}) {
	const envName = tokenEnv ?? 'META_ADS_ACCESS_TOKEN';
	if (tokenEnv && !isValidTokenEnv(tokenEnv)) throw new Error('Nome de variável inválido.');
	const appId = process.env.META_APP_ID;
	const secret = process.env.META_APP_SECRET;
	if (!appId || !secret) {
		throw new Error(
			'Faltam META_APP_ID e META_APP_SECRET no .env (Meta for Developers, app ATHENUM, Configurações, Básico).'
		);
	}
	const current = process.env[envName];
	if (!current) throw new Error(`${envName} não está no .env.`);

	const r = await graph('oauth/access_token', {
		params: {
			grant_type: 'fb_exchange_token',
			client_id: appId,
			client_secret: secret,
			fb_exchange_token: current
		}
	});
	if (!r.access_token) throw new Error('A Meta não devolveu um token novo.');

	const text = await readFile(envFile, 'utf8');
	const line = new RegExp(`^${envName}=.*$`, 'm');
	const next = line.test(text)
		? text.replace(line, () => `${envName}=${r.access_token}`)
		: `${text.replace(/\s*$/, '\n')}${envName}=${r.access_token}\n`;
	await writeFile(envFile, next);
	process.env[envName] = r.access_token;
	return {
		envName,
		expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000) : null
	};
}
