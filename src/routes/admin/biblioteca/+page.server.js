import { fail } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';
import { classify, deleteUpload, saveUpload } from '$lib/server/uploads.js';
import { generateCopies } from '$lib/server/ai/copy.js';
import { hasAnthropic } from '$lib/server/ai/anthropic.js';
import { lintCopy } from '$lib/copyLint.js';
import { cleanText } from '$lib/text.js';
import { OBJECTIVES } from '$lib/campaignSpec.js';
import { objectivesByGroup } from '$lib/objectives.js';

const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 300 * 1024 * 1024;

export const load = async ({ locals, url }) => {
	requireAdmin(locals);
	const clients = await db.client.findMany({
		where: { status: { not: 'ENCERRADO' } },
		orderBy: { name: 'asc' },
		select: { id: true, name: true }
	});
	const clientId =
		clients.find((c) => c.id === url.searchParams.get('cliente'))?.id ?? clients[0]?.id ?? null;
	const [assets, copies] = clientId
		? await Promise.all([
				db.asset.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } }),
				db.copyVariant.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' }, take: 80 })
			])
		: [[], []];
	return {
		withAI: hasAnthropic(),
		clients,
		clientId,
		objectiveGroups: objectivesByGroup(),
		assets: assets.map((a) => ({
			id: a.id,
			name: a.name,
			kind: a.kind,
			sizeBytes: a.sizeBytes,
			onMeta: Boolean(a.metaImageHash || a.metaVideoId),
			createdAt: a.createdAt
		})),
		copies: copies.map((c) => ({
			id: c.id,
			angle: c.angle,
			primaryText: c.primaryText,
			headline: c.headline,
			description: c.description ?? '',
			status: c.status,
			source: c.source,
			lintFlags: c.lintFlags ?? []
		}))
	};
};

async function ownClient(form) {
	const clientId = String(form.get('clientId') ?? '');
	const client = await db.client.findUnique({ where: { id: clientId } });
	return client;
}

export const actions = {
	subir: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const client = await ownClient(form);
		if (!client) return fail(400, { error: 'Cliente inválido.' });
		const files = form.getAll('files').filter((f) => f instanceof File && f.size > 0);
		if (!files.length) return fail(400, { error: 'Escolha pelo menos um arquivo.' });

		let saved = 0;
		const rejected = [];
		for (const file of files) {
			const kind = classify(file.type);
			if (!kind) {
				rejected.push(`${file.name}: formato não aceito (use JPG, PNG, MP4 ou MOV)`);
				continue;
			}
			if (file.size > (kind.kind === 'IMAGE' ? MAX_IMAGE : MAX_VIDEO)) {
				rejected.push(`${file.name}: arquivo grande demais`);
				continue;
			}
			const filePath = await saveUpload(client.id, file, kind.ext);
			await db.asset.create({
				data: {
					clientId: client.id,
					kind: kind.kind,
					name: file.name.replace(/\.[^.]+$/, ''),
					filePath,
					mimeType: file.type,
					sizeBytes: file.size
				}
			});
			saved++;
		}
		await audit({
			userId: admin.id,
			clientId: client.id,
			action: 'asset.upload',
			payload: { saved, rejected }
		});
		if (!saved) return fail(400, { error: rejected.join('. ') });
		return {
			ok: `${saved} criativo(s) enviado(s).${rejected.length ? ` Recusados: ${rejected.join('; ')}.` : ''}`
		};
	},

	excluirAsset: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		const asset = await db.asset.findUnique({ where: { id } });
		if (!asset) return fail(404, { error: 'Criativo não encontrado.' });
		await db.asset.delete({ where: { id } });
		await deleteUpload(asset.filePath).catch(() => {});
		await audit({
			userId: admin.id,
			clientId: asset.clientId,
			action: 'asset.delete',
			target: asset.name
		});
		return { ok: 'Criativo removido da biblioteca.' };
	},

	gerarCopys: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const client = await ownClient(form);
		if (!client) return fail(400, { error: 'Cliente inválido.' });
		const objective = String(form.get('objective') ?? 'LEADS_WHATSAPP');
		if (!OBJECTIVES[objective]) return fail(400, { error: 'Objetivo inválido.' });
		const count = Math.min(10, Math.max(1, Number(form.get('count')) || 5));

		const [brief, existing] = await Promise.all([
			db.clientBrief.findUnique({ where: { clientId: client.id } }),
			db.copyVariant.findMany({
				where: { clientId: client.id, status: { not: 'REJECTED' } },
				orderBy: { createdAt: 'desc' },
				take: 10,
				select: { primaryText: true }
			})
		]);
		let variants;
		try {
			variants = await generateCopies({
				objective,
				brief,
				clientName: client.name,
				angles: String(form.get('angles') ?? ''),
				count,
				instructions: String(form.get('instructions') ?? ''),
				existing: existing.map((e) => e.primaryText)
			});
		} catch (err) {
			return fail(502, { error: `Não consegui gerar as copys: ${err.message}` });
		}
		await db.copyVariant.createMany({
			data: variants.map((v) => ({
				clientId: client.id,
				angle: v.angle,
				primaryText: v.primaryText,
				headline: v.headline,
				description: v.description || null,
				lintFlags: v.lintFlags,
				source: 'claude'
			}))
		});
		await audit({
			userId: admin.id,
			clientId: client.id,
			action: 'copy.generate',
			payload: { count: variants.length, objective }
		});
		return { ok: `${variants.length} variantes criadas. Revise e aprove as que servirem.` };
	},

	salvarCopy: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const copy = {
			primaryText: cleanText(String(form.get('primaryText') ?? '')),
			headline: cleanText(String(form.get('headline') ?? '')),
			description: cleanText(String(form.get('description') ?? ''))
		};
		const found = await db.copyVariant.findUnique({ where: { id } });
		if (!found) return fail(404, { error: 'Copy não encontrada.' });
		await db.copyVariant.update({
			where: { id },
			data: {
				...copy,
				description: copy.description || null,
				lintFlags: lintCopy(copy),
				source: found.source === 'claude' ? 'claude+editada' : found.source
			}
		});
		return { ok: 'Copy salva.' };
	},

	adicionarCopy: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const client = await ownClient(form);
		if (!client) return fail(400, { error: 'Cliente inválido.' });
		const copy = {
			primaryText: cleanText(String(form.get('primaryText') ?? '')),
			headline: cleanText(String(form.get('headline') ?? '')),
			description: cleanText(String(form.get('description') ?? ''))
		};
		if (!copy.primaryText || !copy.headline)
			return fail(400, { error: 'Preencha texto principal e título.' });
		await db.copyVariant.create({
			data: {
				clientId: client.id,
				angle: cleanText(String(form.get('angle') ?? '')) || 'manual',
				...copy,
				description: copy.description || null,
				lintFlags: lintCopy(copy),
				source: 'manual',
				status: 'APPROVED'
			}
		});
		return { ok: 'Copy adicionada e aprovada.' };
	},

	statusCopy: async ({ request, locals }) => {
		requireAdmin(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const status = String(form.get('status') ?? '');
		if (!['APPROVED', 'REJECTED', 'SUGGESTED'].includes(status))
			return fail(400, { error: 'Status inválido.' });
		await db.copyVariant.update({ where: { id }, data: { status } });
		return { ok: true };
	},

	excluirCopy: async ({ request, locals }) => {
		requireAdmin(locals);
		const id = String((await request.formData()).get('id') ?? '');
		await db.copyVariant.delete({ where: { id } }).catch(() => {});
		return { ok: true };
	}
};
