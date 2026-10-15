import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';
import { getTokenHealth } from '$lib/server/meta/token.js';
import { hasAnthropic, model } from '$lib/server/ai/anthropic.js';
import { syncAll } from '$lib/server/sync.js';
import { getSetting, setSetting } from '$lib/server/settings.js';

export const load = async ({ locals }) => {
	requireAdmin(locals);
	// Tokens próprios de clientes (variáveis META_TOKEN_*), agrupados por variável.
	const withToken = await db.adAccount.findMany({
		where: { tokenEnv: { not: null } },
		select: { tokenEnv: true, name: true }
	});
	const byEnv = new Map();
	for (const a of withToken) byEnv.set(a.tokenEnv, [...(byEnv.get(a.tokenEnv) ?? []), a.name]);
	const clientTokens = [];
	for (const [tokenEnv, accounts] of byEnv) {
		const h = await getTokenHealth({ tokenEnv });
		clientTokens.push({
			tokenEnv,
			accounts,
			configured: h.configured,
			ok: h.ok,
			type: h.type ?? null,
			daysLeft: h.daysLeft ?? null,
			warning: h.warning ?? h.error ?? null
		});
	}
	const [token, logs, killSwitch] = await Promise.all([
		getTokenHealth({ force: true }),
		db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
		getSetting('metaWritesDisabled', false)
	]);
	return {
		clientTokens,
		token: {
			configured: token.configured,
			ok: token.ok,
			type: token.type ?? null,
			valid: token.valid ?? null,
			expiresAt: token.expiresAt ?? null,
			daysLeft: token.daysLeft ?? null,
			scopes: token.scopes ?? [],
			missingScopes: token.missingScopes ?? [],
			warning: token.warning ?? token.error ?? null
		},
		ai: { configured: hasAnthropic(), model: model() },
		killSwitch,
		logs: logs.map((l) => ({
			id: l.id,
			action: l.action,
			target: l.target,
			ok: l.ok,
			error: l.error,
			createdAt: l.createdAt
		}))
	};
};

export const actions = {
	sincronizarTudo: async ({ locals }) => {
		const admin = requireAdmin(locals);
		const results = await syncAll();
		await audit({ userId: admin.id, action: 'sync.all', payload: results });
		const failed = results.filter((r) => r.error).length;
		return { ok: `Sincronizadas ${results.length - failed} de ${results.length} contas.` };
	},

	travaEscrita: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const on = (await request.formData()).get('on') === '1';
		await setSetting('metaWritesDisabled', on);
		await audit({ userId: admin.id, action: on ? 'killswitch.on' : 'killswitch.off' });
		return { ok: on ? 'Escrita na Meta bloqueada.' : 'Escrita na Meta liberada.' };
	}
};
