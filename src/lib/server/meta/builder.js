// Escrita na Meta: cria campanha, conjunto, criativo e anúncio. Tudo nasce
// PAUSED; só `setStatus` com ACTIVE liga o gasto, e isso é sempre uma ação
// separada e confirmada (ver actions.js). Os campos seguem o que lemos das
// campanhas reais que já funcionam (WhatsApp da Clínica, formulário de leads).
import path from 'node:path';
import { db } from '../db.js';
import { graph, withAccountToken } from './client.js';
import { readUpload } from '../uploads.js';
import {
	adSetPayload,
	campaignPayload,
	creativePayload,
	SpecSchema,
	validateSpec,
	hasBlockingIssues
} from '../../campaignSpec.js';
import { metaWritesDisabled } from '../settings.js';
import { explainMetaError } from '../../metaErrors.js';

const VALIDATE = { execution_options: ['validate_only'] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Objetos simples ----------------------------------------------------------

export async function createCampaign(account, spec, { validateOnly = false } = {}) {
	const r = await graph(`${account.externalId}/campaigns`, {
		method: 'POST',
		body: { ...campaignPayload(spec), ...(validateOnly ? VALIDATE : {}) }
	});
	return r.id ?? null;
}

export async function createAdSet(account, spec, adSet, campaignId, { validateOnly = false } = {}) {
	const r = await graph(`${account.externalId}/adsets`, {
		method: 'POST',
		body: {
			...adSetPayload(spec, adSet, {
				campaignId,
				pageId: account.pageId,
				advertiserIdentityId: account.advertiserIdentityId ?? ''
			}),
			...(validateOnly ? VALIDATE : {})
		}
	});
	return r.id ?? null;
}

export async function createCreative(account, payload, { validateOnly = false } = {}) {
	const r = await graph(`${account.externalId}/adcreatives`, {
		method: 'POST',
		body: { ...payload, ...(validateOnly ? VALIDATE : {}) }
	});
	return r.id ?? null;
}

export async function createAd(
	account,
	{ name, adSetId, creativeId },
	{ validateOnly = false } = {}
) {
	const r = await graph(`${account.externalId}/ads`, {
		method: 'POST',
		body: {
			name,
			adset_id: adSetId,
			creative: { creative_id: creativeId },
			status: 'PAUSED',
			...(validateOnly ? VALIDATE : {})
		}
	});
	return r.id ?? null;
}

/** Liga ou pausa qualquer objeto. ACTIVE liga gasto: só chamar via ação aprovada. */
export async function setStatus(objectId, status) {
	await graph(objectId, { method: 'POST', body: { status } });
}

export async function setDailyBudget(objectId, cents) {
	await graph(objectId, { method: 'POST', body: { daily_budget: cents } });
}

// --- Upload de mídia ------------------------------------------------------------

async function uploadImage(account, buffer, filename, mimeType) {
	const form = new FormData();
	form.append('filename', new Blob([buffer], { type: mimeType }), filename);
	const r = await graph(`${account.externalId}/adimages`, { method: 'POST', form });
	const hash = Object.values(r.images ?? {})[0]?.hash;
	if (!hash) throw new Error('A Meta não devolveu o hash da imagem.');
	return hash;
}

const SIMPLE_VIDEO_LIMIT = 20 * 1024 * 1024;

async function uploadVideo(account, buffer, filename, mimeType) {
	const act = account.externalId;
	if (buffer.length <= SIMPLE_VIDEO_LIMIT) {
		const form = new FormData();
		form.append('source', new Blob([buffer], { type: mimeType }), filename);
		return (await graph(`${act}/advideos`, { method: 'POST', form })).id;
	}
	// Arquivo grande: envio em partes (start, transfer, finish).
	const start = await graph(`${act}/advideos`, {
		method: 'POST',
		body: { upload_phase: 'start', file_size: buffer.length }
	});
	let { start_offset: from, end_offset: to } = start;
	from = Number(from);
	to = Number(to);
	while (from < to) {
		const form = new FormData();
		form.append('upload_phase', 'transfer');
		form.append('upload_session_id', start.upload_session_id);
		form.append('start_offset', String(from));
		form.append(
			'video_file_chunk',
			new Blob([buffer.subarray(from, to)], { type: mimeType }),
			filename
		);
		const step = await graph(`${act}/advideos`, { method: 'POST', form });
		from = Number(step.start_offset);
		to = Number(step.end_offset);
	}
	await graph(`${act}/advideos`, {
		method: 'POST',
		body: { upload_phase: 'finish', upload_session_id: start.upload_session_id, title: filename }
	});
	return start.video_id;
}

async function waitVideoReady(videoId, { timeoutMs = 5 * 60 * 1000 } = {}) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const r = await graph(videoId, { params: { fields: 'status' } });
		const state = r.status?.video_status;
		if (state === 'ready') return;
		if (state === 'error') throw new Error('A Meta recusou o vídeo (erro no processamento).');
		await sleep(5000);
	}
	throw new Error('O vídeo demorou demais para processar na Meta.');
}

/** Motivo legível de um erro da Meta, com a ação necessária quando conhecida. */
export const explain = explainMetaError;

export async function videoThumbnail(videoId) {
	const r = await graph(`${videoId}/thumbnails`, { params: { fields: 'uri,is_preferred' } });
	const list = r.data ?? [];
	const uri = (list.find((t) => t.is_preferred) ?? list[0])?.uri ?? null;
	if (!uri) throw new Error('A Meta ainda não gerou a capa do vídeo. Tente de novo em instantes.');
	return uri;
}

/** Nome do arquivo com a extensão (a Meta reconhece o tipo por ela). */
function fileNameOf(asset) {
	return `${asset.name}${path.extname(asset.filePath)}`;
}

/** Garante que o criativo da biblioteca existe na conta; devolve o que o payload precisa. */
async function ensureAsset(account, asset) {
	if (asset.kind === 'IMAGE') {
		let hash = asset.metaImageHash;
		if (!hash) {
			hash = await uploadImage(
				account,
				await readUpload(asset.filePath),
				fileNameOf(asset),
				asset.mimeType
			);
			await db.asset.update({ where: { id: asset.id }, data: { metaImageHash: hash } });
		}
		return { kind: 'IMAGE', imageHash: hash };
	}
	let videoId = asset.metaVideoId;
	if (!videoId) {
		videoId = await uploadVideo(
			account,
			await readUpload(asset.filePath),
			fileNameOf(asset),
			asset.mimeType
		);
		await db.asset.update({ where: { id: asset.id }, data: { metaVideoId: videoId } });
	}
	await waitVideoReady(videoId);
	return { kind: 'VIDEO', videoId, thumbnailUrl: await videoThumbnail(videoId) };
}

// --- Orquestração ----------------------------------------------------------------

/** Conta do rascunho (com o nome da variável do token dela). */
async function accountOfDraft(draftId) {
	const d = await db.campaignDraft.findUnique({
		where: { id: draftId },
		include: { account: true }
	});
	if (!d) throw new Error('Rascunho não encontrado.');
	return d.account;
}

async function loadDraft(draftId) {
	const draft = await db.campaignDraft.findUnique({
		where: { id: draftId },
		include: { account: true }
	});
	if (!draft) throw new Error('Rascunho não encontrado.');
	const spec = SpecSchema.parse(draft.spec);
	const assets = await db.asset.findMany({ where: { clientId: draft.clientId } });
	return { draft, spec, assets, assetMap: new Map(assets.map((a) => [a.id, a])) };
}

/**
 * Envia o rascunho pra Meta, tudo pausado. Pode ser repetido: o estado
 * (ids já criados) fica em `metaState` e o que já existe não é recriado.
 */
export async function uploadDraft(draftId) {
	return withAccountToken(await accountOfDraft(draftId), () => uploadDraftInner(draftId));
}

async function uploadDraftInner(draftId) {
	if (await metaWritesDisabled()) throw new Error('A escrita na Meta está bloqueada nos Ajustes.');
	const { draft, spec, assetMap } = await loadDraft(draftId);
	const account = draft.account;

	const issues = validateSpec(spec, account, {
		assetIds: new Set(assetMap.keys()),
		assetKinds: Object.fromEntries([...assetMap].map(([id, a]) => [id, a.kind]))
	});
	if (hasBlockingIssues(issues)) {
		throw new Error(
			`Corrija antes de enviar: ${issues
				.filter((i) => i.level === 'error')
				.map((i) => i.message)
				.join(' ')}`
		);
	}

	const state = draft.metaState ?? { campaignId: null, adSets: [], errors: [] };
	state.errors = [];
	const save = () =>
		db.campaignDraft.update({
			where: { id: draft.id },
			data: {
				metaState: state,
				metaCampaignId: state.campaignId,
				status: 'UPLOADING',
				lastError: null
			}
		});
	await save();

	try {
		if (!state.campaignId) {
			state.campaignId = await createCampaign(account, spec);
			await save();
		}
		for (let i = 0; i < spec.adSets.length; i++) {
			const adSet = spec.adSets[i];
			state.adSets[i] ??= { id: null, ads: [] };
			if (!state.adSets[i].id) {
				state.adSets[i].id = await createAdSet(account, spec, adSet, state.campaignId);
				await save();
			}
			for (let j = 0; j < adSet.ads.length; j++) {
				const ad = adSet.ads[j];
				state.adSets[i].ads[j] ??= { creativeId: null, adId: null };
				const done = state.adSets[i].ads[j];
				if (done.adId) continue;
				try {
					const asset = await ensureAsset(account, assetMap.get(ad.assetId));
					const payload = creativePayload(spec, ad, asset, {
						pageId: account.pageId,
						igUserId: account.igUserId
					});
					done.creativeId ??= await createCreative(account, payload);
					done.adId = await createAd(account, {
						name: ad.name,
						adSetId: state.adSets[i].id,
						creativeId: done.creativeId
					});
				} catch (err) {
					state.errors.push({ adSet: adSet.name, ad: ad.name, message: explain(err) });
				}
				await save();
			}
		}
	} catch (err) {
		await db.campaignDraft.update({
			where: { id: draft.id },
			data: {
				metaState: state,
				metaCampaignId: state.campaignId,
				status: 'FAILED',
				lastError: String(err.message).slice(0, 500)
			}
		});
		throw err;
	}

	const failed = state.errors.length;
	await db.campaignDraft.update({
		where: { id: draft.id },
		data: {
			metaState: state,
			status: failed ? 'FAILED' : 'UPLOADED',
			lastError: failed
				? `${failed} anúncio(s) falharam: ${state.errors
						.map((e) => `${e.ad}: ${e.message}`)
						.join(' | ')
						.slice(0, 450)}`
				: null
		}
	});
	return { campaignId: state.campaignId, failedAds: failed };
}

/**
 * Valida na Meta sem criar nada (execution_options validate_only). Só os
 * criativos e anúncios que não dependem de ids ainda inexistentes.
 */
export async function validateDraftOnMeta(draftId) {
	return withAccountToken(await accountOfDraft(draftId), () => validateDraftInner(draftId));
}

async function validateDraftInner(draftId) {
	const { draft, spec, assetMap } = await loadDraft(draftId);
	const account = draft.account;
	const results = [];
	for (const adSet of spec.adSets) {
		for (const ad of adSet.ads) {
			const a = assetMap.get(ad.assetId);
			if (!a) {
				results.push({ ad: ad.name, ok: false, message: 'Criativo não encontrado na biblioteca.' });
				continue;
			}
			try {
				const media =
					a.kind === 'IMAGE'
						? { kind: 'IMAGE', imageHash: a.metaImageHash }
						: {
								kind: 'VIDEO',
								videoId: a.metaVideoId,
								thumbnailUrl: a.metaVideoId ? await videoThumbnail(a.metaVideoId) : null
							};
				if (!(media.imageHash || media.videoId)) {
					results.push({
						ad: ad.name,
						ok: true,
						message: 'Criativo ainda não foi enviado à Meta; será validado no envio.'
					});
					continue;
				}
				await createCreative(
					account,
					creativePayload(spec, ad, media, { pageId: account.pageId, igUserId: account.igUserId }),
					{ validateOnly: true }
				);
				results.push({ ad: ad.name, ok: true, message: 'A Meta aceitou o criativo.' });
			} catch (err) {
				results.push({ ad: ad.name, ok: false, message: explain(err) });
			}
		}
	}
	return results;
}

/** Liga a campanha, os conjuntos e os anúncios do rascunho (gasta dinheiro de verdade). */
export async function activateDraft(draftId) {
	return withAccountToken(await accountOfDraft(draftId), () => activateDraftInner(draftId));
}

async function activateDraftInner(draftId) {
	if (await metaWritesDisabled()) throw new Error('A escrita na Meta está bloqueada nos Ajustes.');
	const { draft } = await loadDraft(draftId);
	const state = draft.metaState;
	if (!state?.campaignId) throw new Error('Envie o rascunho para a Meta antes de ativar.');
	if (state.errors?.length) throw new Error('Há anúncios com falha. Reenvie antes de ativar.');
	for (const s of state.adSets) {
		for (const ad of s.ads) if (ad.adId) await setStatus(ad.adId, 'ACTIVE');
		if (s.id) await setStatus(s.id, 'ACTIVE');
	}
	await setStatus(state.campaignId, 'ACTIVE');
	await db.campaignDraft.update({ where: { id: draft.id }, data: { status: 'ACTIVE' } });
}

/** Busca cidades pro seletor de público. */
export async function searchCities(query) {
	const r = await graph('search', {
		params: { type: 'adgeolocation', location_types: ['city'], q: query, limit: 8 }
	});
	return (r.data ?? []).map((c) => ({
		key: c.key,
		name: c.region ? `${c.name}, ${c.region}` : c.name,
		country: c.country_code
	}));
}
