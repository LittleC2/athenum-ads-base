import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';
import { cleanText } from '$lib/text.js';
import { fromDbDate } from '$lib/dates.js';

async function findReport(id) {
	const report = await db.report.findUnique({
		where: { id },
		include: {
			client: { select: { id: true, name: true } },
			account: { select: { resultType: true } }
		}
	});
	if (!report) throw error(404, 'Relatório não encontrado.');
	return report;
}

export const load = async ({ params, locals }) => {
	requireAdmin(locals);
	const r = await findReport(params.id);
	return {
		report: {
			id: r.id,
			title: r.title,
			status: r.status,
			generatedBy: r.generatedBy,
			clientId: r.client.id,
			clientName: r.client.name,
			periodStart: fromDbDate(r.periodStart),
			periodEnd: fromDbDate(r.periodEnd),
			clientSummary: r.clientSummary,
			internalAnalysis: r.internalAnalysis,
			recommendations: r.recommendations ?? [],
			kpis: r.kpis,
			publishedAt: r.publishedAt
		}
	};
};

export const actions = {
	salvar: async ({ request, params, locals }) => {
		const admin = requireAdmin(locals);
		await findReport(params.id);
		const form = await request.formData();
		const title = cleanText(String(form.get('title') ?? ''));
		if (!title) return fail(400, { error: 'O título não pode ficar vazio.' });
		await db.report.update({
			where: { id: params.id },
			data: {
				title,
				clientSummary: cleanText(String(form.get('clientSummary') ?? '')),
				internalAnalysis: cleanText(String(form.get('internalAnalysis') ?? ''))
			}
		});
		await audit({ userId: admin.id, action: 'report.update', target: params.id });
		return { ok: 'Relatório salvo.' };
	},

	publicar: async ({ params, locals }) => {
		const admin = requireAdmin(locals);
		const r = await findReport(params.id);
		if (!r.clientSummary.trim())
			return fail(400, { error: 'Escreva o resumo do cliente antes de publicar.' });
		await db.report.update({
			where: { id: params.id },
			data: { status: 'PUBLISHED', publishedAt: new Date() }
		});
		await audit({
			userId: admin.id,
			clientId: r.clientId,
			action: 'report.publish',
			target: params.id
		});
		return { ok: 'Publicado no portal do cliente.' };
	},

	despublicar: async ({ params, locals }) => {
		const admin = requireAdmin(locals);
		const r = await findReport(params.id);
		await db.report.update({
			where: { id: params.id },
			data: { status: 'DRAFT', publishedAt: null }
		});
		await audit({
			userId: admin.id,
			clientId: r.clientId,
			action: 'report.unpublish',
			target: params.id
		});
		return { ok: 'Voltou para rascunho e saiu do portal.' };
	},

	excluir: async ({ params, locals }) => {
		const admin = requireAdmin(locals);
		const r = await findReport(params.id);
		await db.report.delete({ where: { id: params.id } });
		await audit({
			userId: admin.id,
			clientId: r.clientId,
			action: 'report.delete',
			target: params.id
		});
		throw redirect(303, '/admin/relatorios');
	}
};
