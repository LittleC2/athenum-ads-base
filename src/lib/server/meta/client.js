// Cliente fino da Meta Graph/Marketing API. fetch cru, sem SDK. O token vai no
// cabeçalho Authorization (nunca na URL), então não vaza em log nem em erro.
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '$env/dynamic/private';
import { cleanToken, redactSecrets } from '../../redact.js';
import { isValidTokenEnv } from '../../tokenEnv.js';

export class MetaApiError extends Error {
	constructor(message, details) {
		super(message);
		this.name = 'MetaApiError';
		this.details = details ?? null;
		this.code = details?.code ?? null;
		this.subcode = details?.error_subcode ?? null;
		this.userMessage = details?.error_user_msg ?? null;
	}
}

// Códigos de limite de taxa/uso da Meta: vale esperar e tentar de novo.
const RETRY_CODES = new Set([4, 17, 32, 613, 80000, 80001, 80003, 80004, 80006]);

export function graphBase() {
	return `https://graph.facebook.com/${env.META_GRAPH_VERSION || 'v21.0'}`;
}

/** Há token geral configurado? Com `tokenEnv`, confere o token específico daquele cliente. */
export function hasToken(tokenEnv = null) {
	if (tokenEnv) return isValidTokenEnv(tokenEnv) && Boolean(env[tokenEnv]);
	return Boolean(env.META_ADS_ACCESS_TOKEN);
}

/** Token pelo nome da variável de ambiente (null = token geral). */
export function tokenFor(tokenEnv = null) {
	if (tokenEnv) {
		if (!isValidTokenEnv(tokenEnv))
			throw new MetaApiError(`Nome de variável de token inválido: ${tokenEnv}`);
		if (!env[tokenEnv])
			throw new MetaApiError(`A variável ${tokenEnv} não está configurada no servidor.`);
		return cleanToken(env[tokenEnv]);
	}
	if (!env.META_ADS_ACCESS_TOKEN) throw new MetaApiError('META_ADS_ACCESS_TOKEN não configurado.');
	return cleanToken(env.META_ADS_ACCESS_TOKEN);
}

// Cada conta pode ter o próprio token (variável META_TOKEN_*). Em vez de passar o
// token por todas as funções, o contexto da chamada carrega qual usar.
const tokenContext = new AsyncLocalStorage();

/** Roda `fn` falando com a Meta com o token da conta (ou o geral, se ela não tiver um). */
export function withAccountToken(account, fn) {
	return tokenContext.run({ tokenEnv: account?.tokenEnv ?? null }, fn);
}

function token() {
	return tokenFor(tokenContext.getStore()?.tokenEnv ?? null);
}

function buildUrl(path, params) {
	const url = new URL(`${graphBase()}/${path.replace(/^\//, '')}`);
	for (const [key, value] of Object.entries(params ?? {})) {
		if (value == null) continue;
		url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
	}
	return url;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} path ex: 'act_123/insights'
 * @param {{ method?: string, params?: object, body?: object, form?: FormData, retries?: number }} [opts]
 */
export async function graph(path, { method = 'GET', params, body, form, retries = 3 } = {}) {
	const headers = { Authorization: `Bearer ${token()}` };
	const init = { method, headers };
	if (form) init.body = form;
	else if (body) {
		headers['Content-Type'] = 'application/json';
		init.body = JSON.stringify(body);
	}
	const url = buildUrl(path, params);

	let attempt = 0;
	for (;;) {
		let res;
		try {
			res = await fetch(url, init);
		} catch (err) {
			if (attempt < retries) {
				await sleep(2000 * 2 ** attempt++);
				continue;
			}
			throw new MetaApiError(`Falha de rede ao falar com a Meta: ${redactSecrets(err.message)}`);
		}
		const json = await res.json().catch(() => null);
		if (res.ok && !json?.error) return json;
		const details = json?.error;
		if (details && RETRY_CODES.has(details.code) && attempt < retries) {
			await sleep(5000 * 2 ** attempt++);
			continue;
		}
		throw new MetaApiError(
			details?.message ?? `A Meta respondeu ${res.status} sem corpo JSON.`,
			details
		);
	}
}

/** GET com paginação por cursor (nunca segue paging.next, que carrega o token). */
export async function paginate(path, params = {}, { maxPages = 400 } = {}) {
	const out = [];
	let after;
	for (let page = 0; page < maxPages; page++) {
		const json = await graph(path, { params: { limit: 500, ...params, after } });
		out.push(...(json.data ?? []));
		after = json.paging?.cursors?.after;
		if (!after || !json.paging?.next) break;
	}
	return out;
}
