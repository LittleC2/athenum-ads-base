import { error, fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';
import { generatePassword, hashPassword, deleteUserSessions } from '$lib/server/auth.js';
import {
	loadAlerts,
	loadBreakdowns,
	loadDashboard,
	summarizeBreakdown
} from '$lib/server/dashboard.js';
import { discoverAccounts } from '$lib/server/meta/accounts.js';
import { syncAccount } from '$lib/server/sync.js';
import { recomputeResults } from '$lib/server/meta/insights.js';
import { normalizePreset, fromDbDate } from '$lib/dates.js';
import { optionalFloat, toCents } from '$lib/money.js';
import { isValidTokenEnv } from '$lib/tokenEnv.js';
import { getTokenHealth } from '$lib/server/meta/token.js';

const TABS = ['painel', 'contas', 'brief', 'acessos'];
const RESULT_TYPES = ['LEAD_FORM', 'WHATSAPP', 'PURCHASE', 'LINK_CLICK'];

export const load = async ({ params, url, locals }) => {
	requireAdmin(locals);
	const client = await db.client.findUnique({
		where: { id: params.id },
		include: {
			brief: true,
			accounts: { orderBy: { createdAt: 'asc' } },
			users: { orderBy: { createdAt: 'asc' } }
		}
	});
	if (!client) throw error(404, 'Cliente não encontrado.');

	const aba = TABS.includes(url.searchParams.get('aba')) ? url.searchParams.get('aba') : 'painel';
	const base = {
		aba,
		client: {
			id: client.id,
			name: client.name,
			segment: client.segment,
			status: client.status,
			notes: client.notes
		},
		brief: client.brief,
		accounts: client.accounts,
		users: client.users.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			active: u.active,
			lastLoginAt: u.lastLoginAt,
			mustChangePassword: u.mustChangePassword
		}))
	};

	if (aba === 'painel') {
		const account =
			client.accounts.find((a) => a.id === url.searchParams.get('conta')) ?? client.accounts[0];
		if (!account) return { ...base, account: null };
		const preset = normalizePreset(url.searchParams.get('periodo'));
		const [dashboard, alerts, breakdowns] = await Promise.all([
			loadDashboard(account, preset),
			loadAlerts(account.id, { forClient: false }),
			loadBreakdowns(account, preset)
		]);
		return {
			...base,
			account,
			preset,
			dashboard,
			alerts,
			age: summarizeBreakdown(
				breakdowns.age,
				account.resultType,
				(r) =>
					`${r.age} · ${r.gender === 'female' ? 'mulheres' : r.gender === 'male' ? 'homens' : 'n/d'}`
			),
			placement: summarizeBreakdown(
				breakdowns.placement,
				account.resultType,
				(r) => `${r.publisher_platform} · ${r.platform_position}`
			)
		};
	}

	if (aba === 'contas') {
		let discovered = [];
		let discoverError = null;
		try {
			const linked = new Set(
				(await db.adAccount.findMany({ select: { externalId: true } })).map((a) => a.externalId)
			);
			discovered = (await discoverAccounts()).map((a) => ({
				...a,
				linked: linked.has(a.externalId)
			}));
		} catch (err) {
			discoverError = err.message;
		}
		const feedbacks = await db.resultFeedback.findMany({
			where: { clientId: client.id },
			orderBy: { periodStart: 'desc' },
			take: 12
		});
		// Situação do token de cada conta (o token geral ou a variável META_TOKEN_* dela).
		const tokens = {};
		for (const a of client.accounts) {
			const key = a.tokenEnv ?? 'default';
			if (tokens[key]) continue;
			const h = await getTokenHealth({ tokenEnv: a.tokenEnv });
			tokens[key] = {
				ok: h.ok,
				configured: h.configured,
				type: h.type ?? null,
				daysLeft: h.daysLeft ?? null,
				warning: h.warning ?? h.error ?? null
			};
		}
		return {
			...base,
			tokens,
			discovered,
			discoverError,
			feedbacks: feedbacks.map((f) => ({
				...f,
				periodStart: fromDbDate(f.periodStart),
				periodEnd: fromDbDate(f.periodEnd)
			}))
		};
	}

	return base;
};

async function clientOr404(id) {
	const client = await db.client.findUnique({ where: { id } });
	if (!client) throw error(404, 'Cliente não encontrado.');
	return client;
}

export const actions = {
	salvarCliente: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (name.length < 2) return fail(400, { error: 'Informe o nome.' });
		const status = ['ATIVO', 'PAUSADO', 'ENCERRADO'].includes(form.get('status'))
			? form.get('status')
			: 'ATIVO';
		await db.client.update({
			where: { id: params.id },
			data: {
				name,
				status,
				segment: String(form.get('segment') ?? '').trim() || null,
				notes: String(form.get('notes') ?? '').trim() || null
			}
		});
		await audit({ userId: admin.id, clientId: params.id, action: 'client.update' });
		return { ok: 'Cliente salvo.' };
	},

	salvarBrief: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		await clientOr404(params.id);
		const form = await request.formData();
		const ticket = toCents(form.get('ticket'));
		const closeRate = optionalFloat(form.get('closeRate'));
		if (ticket.error || closeRate.error)
			return fail(400, { error: 'Confira o ticket e a taxa de fechamento.' });
		const text = (k) => String(form.get(k) ?? '').trim() || null;
		const data = {
			offer: text('offer'),
			audience: text('audience'),
			tone: text('tone'),
			restrictions: text('restrictions'),
			extra: text('extra'),
			ticketCents: ticket.value,
			closeRatePct: closeRate.value
		};
		await db.clientBrief.upsert({
			where: { clientId: params.id },
			update: data,
			create: { clientId: params.id, ...data }
		});
		await audit({ userId: admin.id, clientId: params.id, action: 'brief.update' });
		return { ok: 'Briefing salvo.' };
	},

	vincularConta: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		await clientOr404(params.id);
		const form = await request.formData();
		// Aceita a conta escolhida na lista ou digitada (só números ou act_123).
		const typed = String(form.get('externalIdManual') ?? '').trim();
		const externalId = typed
			? /^\d+$/.test(typed)
				? `act_${typed}`
				: typed
			: String(form.get('externalId') ?? '').trim();
		const name = String(form.get('name') ?? '').trim();
		const tokenEnv = String(form.get('tokenEnv') ?? '').trim() || null;
		if (!/^act_\d+$/.test(externalId))
			return fail(400, { error: 'ID da conta inválido (formato act_123...).' });
		if (tokenEnv && !isValidTokenEnv(tokenEnv))
			return fail(400, {
				error: 'Nome do token inválido. Use o formato META_TOKEN_NOME (maiúsculas, números e _).'
			});
		if (await db.adAccount.findUnique({ where: { externalId } })) {
			return fail(400, { error: 'Essa conta já está vinculada a um cliente.' });
		}
		const account = await db.adAccount.create({
			data: { clientId: params.id, externalId, name: name || externalId, tokenEnv }
		});
		await audit({
			userId: admin.id,
			clientId: params.id,
			accountId: account.id,
			action: 'account.link',
			target: externalId
		});
		return { ok: 'Conta vinculada. Ajuste o tipo de resultado e sincronize.' };
	},

	salvarConta: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const account = await db.adAccount.findFirst({
			where: { id: String(form.get('accountId') ?? ''), clientId: params.id }
		});
		if (!account) return fail(404, { error: 'Conta não encontrada.' });

		const monthly = toCents(form.get('monthlyBudget'));
		const target = toCents(form.get('targetCost'));
		const maxDaily = toCents(form.get('maxDailyBudget'));
		if (monthly.error || target.error || maxDaily.error)
			return fail(400, { error: 'Confira os valores em reais.' });
		const tokenEnv = String(form.get('tokenEnv') ?? '').trim() || null;
		if (tokenEnv && !isValidTokenEnv(tokenEnv))
			return fail(400, {
				error: 'Nome do token inválido. Use o formato META_TOKEN_NOME, só maiúsculas, números e _.'
			});
		const resultType = RESULT_TYPES.includes(form.get('resultType'))
			? form.get('resultType')
			: account.resultType;

		const updated = await db.adAccount.update({
			where: { id: account.id },
			data: {
				name: String(form.get('name') ?? '').trim() || account.name,
				resultType,
				monthlyBudgetCents: monthly.value,
				targetCostCents: target.value,
				maxDailyBudgetCents: maxDaily.value,
				pageId: String(form.get('pageId') ?? '').trim() || null,
				igUserId: String(form.get('igUserId') ?? '').trim() || null,
				tokenEnv,
				advertiserIdentityId: String(form.get('advertiserIdentityId') ?? '').trim() || null,
				active: form.get('active') === 'on'
			}
		});
		if (resultType !== account.resultType) await recomputeResults(updated);
		await audit({
			userId: admin.id,
			clientId: params.id,
			accountId: account.id,
			action: 'account.update'
		});
		return { ok: 'Conta salva.' };
	},

	sincronizar: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const account = await db.adAccount.findFirst({
			where: { id: String(form.get('accountId') ?? ''), clientId: params.id }
		});
		if (!account) return fail(404, { error: 'Conta não encontrada.' });
		try {
			const r = await syncAccount(account.id, { fullBackfill: form.get('full') === '1' });
			await audit({
				userId: admin.id,
				clientId: params.id,
				accountId: account.id,
				action: 'account.sync',
				payload: r
			});
			return {
				ok: r.skipped
					? 'Já há uma sincronização em andamento.'
					: `Sincronizado: ${r.rows} linhas, ${r.alerts} alertas.`
			};
		} catch (err) {
			return fail(502, { error: `Falha ao sincronizar: ${err.message}` });
		}
	},

	criarAcesso: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		await clientOr404(params.id);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email))
			return fail(400, { error: 'Informe nome e e-mail válidos.' });
		if (await db.user.findUnique({ where: { email } }))
			return fail(400, { error: 'Esse e-mail já tem acesso.' });

		const senha = generatePassword();
		const user = await db.user.create({
			data: {
				name,
				email,
				role: 'CLIENT',
				clientId: params.id,
				passwordHash: await hashPassword(senha),
				mustChangePassword: true
			}
		});
		await audit({
			userId: admin.id,
			clientId: params.id,
			action: 'user.create',
			target: user.email
		});
		return { novaSenha: { email, senha } };
	},

	redefinirSenha: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const user = await db.user.findFirst({
			where: { id: String(form.get('userId') ?? ''), clientId: params.id, role: 'CLIENT' }
		});
		if (!user) return fail(404, { error: 'Acesso não encontrado.' });
		const senha = generatePassword();
		await db.user.update({
			where: { id: user.id },
			data: {
				passwordHash: await hashPassword(senha),
				mustChangePassword: true,
				failedLogins: 0,
				lockedUntil: null
			}
		});
		await deleteUserSessions(user.id);
		await audit({
			userId: admin.id,
			clientId: params.id,
			action: 'user.reset',
			target: user.email
		});
		return { novaSenha: { email: user.email, senha } };
	},

	alternarAcesso: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const user = await db.user.findFirst({
			where: { id: String(form.get('userId') ?? ''), clientId: params.id, role: 'CLIENT' }
		});
		if (!user) return fail(404, { error: 'Acesso não encontrado.' });
		await db.user.update({ where: { id: user.id }, data: { active: !user.active } });
		if (user.active) await deleteUserSessions(user.id);
		await audit({
			userId: admin.id,
			clientId: params.id,
			action: user.active ? 'user.disable' : 'user.enable',
			target: user.email
		});
		return { ok: user.active ? 'Acesso desativado.' : 'Acesso reativado.' };
	}
};
