import { fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';
import { createReportDraft } from '$lib/server/reports.js';
import { hasAnthropic } from '$lib/server/ai/anthropic.js';
import {
	customPeriod,
	fromDbDate,
	normalizePreset,
	periodFromPreset,
	PERIOD_LABELS
} from '$lib/dates.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const load = async ({ locals, url }) => {
	requireAdmin(locals);
	const clientFilter = url.searchParams.get('cliente');
	const [reports, accounts] = await Promise.all([
		db.report.findMany({
			where: clientFilter ? { clientId: clientFilter } : {},
			orderBy: { createdAt: 'desc' },
			take: 60,
			include: { client: { select: { name: true } } }
		}),
		db.adAccount.findMany({
			where: { active: true },
			orderBy: { name: 'asc' },
			include: { client: { select: { id: true, name: true } } }
		})
	]);
	return {
		withAI: hasAnthropic(),
		clientFilter,
		presets: Object.entries(PERIOD_LABELS),
		accounts: accounts.map((a) => ({
			id: a.id,
			name: a.name,
			clientId: a.client.id,
			clientName: a.client.name
		})),
		reports: reports.map((r) => ({
			id: r.id,
			title: r.title,
			clientName: r.client.name,
			status: r.status,
			generatedBy: r.generatedBy,
			periodStart: fromDbDate(r.periodStart),
			periodEnd: fromDbDate(r.periodEnd),
			createdAt: r.createdAt
		}))
	};
};

export const actions = {
	gerar: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const account = await db.adAccount.findUnique({
			where: { id: String(form.get('accountId') ?? '') }
		});
		if (!account) return fail(400, { error: 'Escolha uma conta.' });

		const since = String(form.get('since') ?? '');
		const until = String(form.get('until') ?? '');
		let period;
		if (since || until) {
			if (!DATE_RE.test(since) || !DATE_RE.test(until) || since > until)
				return fail(400, { error: 'Confira as datas.' });
			period = customPeriod(since, until);
		} else {
			period = periodFromPreset(normalizePreset(String(form.get('preset') ?? '7d')));
		}

		let report;
		try {
			report = await createReportDraft(account, period);
		} catch (err) {
			return fail(500, { error: `Não consegui gerar o relatório: ${err.message}` });
		}
		await audit({
			userId: admin.id,
			clientId: account.clientId,
			accountId: account.id,
			action: 'report.generate',
			target: report.id,
			payload: { generatedBy: report.generatedBy }
		});
		throw redirect(303, `/admin/relatorios/${report.id}`);
	}
};
