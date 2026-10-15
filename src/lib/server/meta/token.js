// Saúde do token da Meta: tipo, validade e permissões. Vale pro token geral e pro
// token de cada cliente (variável META_TOKEN_*). Token de usuário expira; o ideal
// é um System User, que não expira.
import { graph, hasToken, tokenFor, withAccountToken } from './client.js';

const REQUIRED_SCOPES = ['ads_read', 'ads_management', 'business_management'];
const cache = new Map();

/**
 * @param {{ force?: boolean, tokenEnv?: string|null }} [opts] tokenEnv null = token geral
 * @returns {Promise<{ ok: boolean, configured: boolean, valid?: boolean, type?: string,
 *   expiresAt?: Date|null, daysLeft?: number|null, scopes?: string[], missingScopes?: string[],
 *   warning?: string|null, error?: string }>}
 */
export async function getTokenHealth({ force = false, tokenEnv = null } = {}) {
	const label = tokenEnv ?? 'META_ADS_ACCESS_TOKEN';
	if (!hasToken(tokenEnv)) {
		return { ok: false, configured: false, error: `${label} não configurado no servidor.` };
	}
	const key = tokenEnv ?? 'default';
	const hit = cache.get(key);
	if (!force && hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.value;

	let value;
	try {
		const json = await withAccountToken({ tokenEnv }, () =>
			graph('debug_token', { params: { input_token: tokenFor(tokenEnv) } })
		);
		const d = json.data ?? {};
		const expiresAt = d.expires_at ? new Date(d.expires_at * 1000) : null;
		const daysLeft = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 86400000) : null;
		const scopes = d.scopes ?? [];
		const missingScopes = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
		let warning = null;
		if (!d.is_valid) warning = 'O token da Meta não é mais válido. Gere um novo.';
		else if (daysLeft != null && daysLeft <= 14) {
			warning = `O token da Meta expira em ${daysLeft} dia(s). Troque por um token de System User, que não expira.`;
		} else if (missingScopes.length) {
			warning = `Faltam permissões no token: ${missingScopes.join(', ')}.`;
		}
		value = {
			ok:
				Boolean(d.is_valid) && missingScopes.length === 0 && !(daysLeft != null && daysLeft <= 14),
			configured: true,
			valid: Boolean(d.is_valid),
			type: d.type ?? null,
			expiresAt,
			daysLeft,
			scopes,
			missingScopes,
			warning
		};
	} catch (err) {
		value = { ok: false, configured: true, error: err.message };
	}
	cache.set(key, { at: Date.now(), value });
	return value;
}
