// Especificação de campanha (o que o gestor monta e o Claude propõe),
// validação com regras de segurança e montagem dos payloads da Meta.
// Módulo puro: nada aqui fala com a rede nem com o banco.
import { z } from 'zod';
import { hasLintErrors, lintCopy } from './copyLint.js';
import { brl } from './format.js';
import { NEED_LABELS, OBJECTIVES, OBJECTIVE_KEYS, ctasFor } from './objectives.js';

export { OBJECTIVES, OBJECTIVE_KEYS, NEED_LABELS, ctasFor } from './objectives.js';

/** Botões por objetivo (compatível com o formato antigo). */
export const CTAS = Object.fromEntries(OBJECTIVE_KEYS.map((k) => [k, ctasFor(k)]));

export const PLACEMENT_PRESETS = {
	automatic: 'Automático (recomendado pela Meta)',
	instagram_stories_reels: 'Instagram: Stories e Reels',
	instagram_all: 'Instagram: feed, Stories e Reels',
	facebook_instagram_feed: 'Feed do Facebook e do Instagram'
};

const AdSchema = z.object({
	name: z.string().min(1).max(100),
	assetId: z.string().default(''),
	primaryText: z.string(),
	headline: z.string(),
	description: z.string().optional().default(''),
	cta: z.string()
});

const AdSetSchema = z.object({
	name: z.string().min(1).max(100),
	dailyBudgetCents: z.number().int().nonnegative().optional().default(0),
	countries: z.array(z.string().length(2)).default([]),
	cities: z
		.array(
			z.object({
				key: z.string(),
				name: z.string(),
				radiusKm: z.number().int().min(17).max(80).default(25)
			})
		)
		.default([]),
	ageMin: z.number().int().min(18).max(65).default(18),
	ageMax: z.number().int().min(18).max(65).default(65),
	genders: z.enum(['all', 'female', 'male']).default('all'),
	advantageAudience: z.boolean().default(true),
	customAudienceIds: z.array(z.string()).default([]),
	excludedAudienceIds: z.array(z.string()).default([]),
	placement: z
		.enum(['automatic', 'instagram_stories_reels', 'instagram_all', 'facebook_instagram_feed'])
		.default('automatic'),
	ads: z.array(AdSchema).default([])
});

export const SpecSchema = z.object({
	campaignName: z.string().min(1).max(150),
	objective: z.enum(OBJECTIVE_KEYS),
	budgetMode: z.enum(['ABO', 'CBO']).default('ABO'),
	campaignDailyBudgetCents: z.number().int().nonnegative().optional().default(0),
	// Anunciante responsável (beneficiário e pagador). A Meta exige em alguns conjuntos (lei europeia de serviços digitais).
	advertiserName: z.string().optional().default(''),
	// ID da identidade verificada do anunciante (Configurações do negócio, Autorizações e verificações).
	advertiserIdentityId: z.string().optional().default(''),
	destination: z
		.object({
			leadFormId: z.string().optional().default(''),
			url: z.string().optional().default(''),
			pixelId: z.string().optional().default(''),
			// Evento do pixel que a campanha otimiza (padrão do objetivo: LEAD ou PURCHASE).
			eventType: z.string().optional().default(''),
			instagramUsername: z.string().optional().default(''),
			phone: z.string().optional().default(''),
			appId: z.string().optional().default(''),
			storeUrl: z.string().optional().default(''),
			catalogId: z.string().optional().default(''),
			productSetId: z.string().optional().default(''),
			// Publicação existente da Página (impulsionar): ID no formato pagina_publicacao.
			postId: z.string().optional().default('')
		})
		.default({
			leadFormId: '',
			url: '',
			pixelId: '',
			eventType: '',
			instagramUsername: '',
			phone: '',
			appId: '',
			storeUrl: '',
			catalogId: '',
			productSetId: '',
			postId: ''
		}),
	adSets: z.array(AdSetSchema).default([])
});

/** Spec vazia e válida pra começar. */
export function emptySpec(objective, name = 'Nova campanha') {
	return SpecSchema.parse({
		campaignName: name,
		objective,
		adSets: [{ name: 'Conjunto 1', countries: ['BR'] }]
	});
}

/** Orçamento diário total que a spec gasta quando ativada. */
export function totalDailyBudgetCents(spec) {
	return spec.budgetMode === 'CBO'
		? spec.campaignDailyBudgetCents
		: spec.adSets.reduce((sum, s) => sum + (s.dailyBudgetCents ?? 0), 0);
}

/**
 * Problemas que impedem (error) ou pedem atenção (warn) antes de enviar.
 * @param {z.infer<typeof SpecSchema>} spec
 * @param {{ pageId: string|null, maxDailyBudgetCents: number|null }} account
 * @param {{ assetIds?: Set<string>, assetKinds?: Record<string, string> }} [ctx]
 */
export function validateSpec(spec, account, ctx = {}) {
	const issues = [];
	const err = (message) => issues.push({ level: 'error', message });
	const warn = (message) => issues.push({ level: 'warn', message });

	if (!account.pageId)
		err('A conta não tem página do Facebook configurada (Clientes, aba Contas).');
	if (!spec.adSets.length) err('Adicione pelo menos um conjunto de anúncios.');

	const total = totalDailyBudgetCents(spec);
	if (total <= 0) err('Defina o orçamento diário.');
	if (account.maxDailyBudgetCents && total > account.maxDailyBudgetCents) {
		err(
			`Orçamento diário ${brl(total)} passa do teto de segurança desta conta (${brl(account.maxDailyBudgetCents)}).`
		);
	}
	if (total > 0 && total < 600) warn('Orçamento diário abaixo de R$ 6,00: a Meta pode recusar.');

	const def = OBJECTIVES[spec.objective];
	for (const need of def.needs) {
		const value = (spec.destination[need] ?? '').trim();
		if (!value) err(`Informe: ${NEED_LABELS[need] ?? need}.`);
		else if ((need === 'url' || need === 'storeUrl') && !/^https?:\/\//.test(value))
			err(`${NEED_LABELS[need]} precisa começar com https://.`);
		else if (need === 'phone' && !/^\+\d{10,15}$/.test(value.replace(/[\s()-]/g, '')))
			err('Telefone no formato +5521999999999.');
	}
	if (def.experimental)
		warn(
			'Objetivo ainda não validado ao vivo na Meta: confira o resultado do "Validar na Meta" antes de enviar.'
		);

	spec.adSets.forEach((s, i) => {
		const where = `Conjunto "${s.name || i + 1}"`;
		if (spec.budgetMode === 'ABO' && s.dailyBudgetCents <= 0)
			err(`${where}: defina o orçamento diário.`);
		if (!s.countries.length && !s.cities.length)
			err(`${where}: escolha onde o anúncio aparece (país ou cidade).`);
		if (s.ageMin > s.ageMax) err(`${where}: idade mínima maior que a máxima.`);
		if (!s.ads.length) err(`${where}: adicione pelo menos um anúncio.`);
		if (s.advantageAudience && (s.genders !== 'all' || s.ageMax < 65 || s.ageMin > 18)) {
			warn(
				`${where}: com Advantage+ ligado, idade e gênero viram só sugestão e a Meta pode entregar fora deles. Desligue o Advantage+ se for exigência.`
			);
		}
		const names = new Set();
		s.ads.forEach((ad) => {
			const adWhere = `${where}, anúncio "${ad.name}"`;
			if (names.has(ad.name)) err(`${adWhere}: nome repetido no conjunto.`);
			names.add(ad.name);
			if (!ad.assetId) err(`${adWhere}: escolha o criativo.`);
			else if (ctx.assetIds && !ctx.assetIds.has(ad.assetId))
				err(`${adWhere}: criativo não encontrado na biblioteca.`);
			else if (def.videoOnly && ctx.assetKinds && ctx.assetKinds[ad.assetId] !== 'VIDEO')
				err(`${adWhere}: este objetivo precisa de vídeo.`);
			if (!CTAS[spec.objective].includes(ad.cta))
				err(`${adWhere}: botão "${ad.cta}" não serve para este objetivo.`);
			const flags = lintCopy(ad);
			if (hasLintErrors(flags))
				flags.filter((f) => f.level === 'error').forEach((f) => err(`${adWhere}: ${f.message}`));
			flags.filter((f) => f.level === 'warn').forEach((f) => warn(`${adWhere}: ${f.message}`));
		});
	});

	return issues;
}

export function hasBlockingIssues(issues) {
	return issues.some((i) => i.level === 'error');
}

// --- Payloads da Meta --------------------------------------------------------

const GENDER_CODE = { male: [1], female: [2] };

/** Posicionamentos: automático não manda nada (a Meta decide). */
export function placementTargeting(placement) {
	switch (placement) {
		case 'instagram_stories_reels':
			return { publisher_platforms: ['instagram'], instagram_positions: ['story', 'reels'] };
		case 'instagram_all':
			return {
				publisher_platforms: ['instagram'],
				instagram_positions: ['stream', 'story', 'reels']
			};
		case 'facebook_instagram_feed':
			return {
				publisher_platforms: ['facebook', 'instagram'],
				facebook_positions: ['feed'],
				instagram_positions: ['stream']
			};
		default:
			return {};
	}
}

export function targetingPayload(adSet) {
	const geo = {};
	if (adSet.countries.length) geo.countries = adSet.countries;
	if (adSet.cities.length) {
		geo.cities = adSet.cities.map((c) => ({
			key: c.key,
			radius: c.radiusKm,
			distance_unit: 'kilometer'
		}));
		geo.location_types = ['home', 'recent'];
	}
	const t = {
		geo_locations: geo,
		age_min: adSet.ageMin,
		targeting_automation: { advantage_audience: adSet.advantageAudience ? 1 : 0 },
		...placementTargeting(adSet.placement)
	};
	if (adSet.advantageAudience) {
		// Com Advantage+ a Meta exige age_max 65; a faixa pedida vira sugestão.
		t.age_max = 65;
		if (adSet.ageMax < 65 || adSet.ageMin > 18) t.age_range = [adSet.ageMin, adSet.ageMax];
	} else {
		t.age_max = adSet.ageMax;
	}
	if (adSet.genders !== 'all') t.genders = GENDER_CODE[adSet.genders];
	if (adSet.customAudienceIds.length)
		t.custom_audiences = adSet.customAudienceIds.map((id) => ({ id }));
	if (adSet.excludedAudienceIds.length)
		t.excluded_custom_audiences = adSet.excludedAudienceIds.map((id) => ({ id }));
	return t;
}

export function campaignPayload(spec) {
	const body = {
		name: spec.campaignName,
		objective: OBJECTIVES[spec.objective].metaObjective,
		status: 'PAUSED',
		special_ad_categories: []
	};
	if (spec.budgetMode === 'CBO') {
		body.daily_budget = spec.campaignDailyBudgetCents;
		body.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
	} else {
		body.is_adset_budget_sharing_enabled = false;
	}
	return body;
}

export function adSetPayload(spec, adSet, { campaignId, pageId, advertiserIdentityId = '' }) {
	const base = {
		name: adSet.name,
		campaign_id: campaignId,
		billing_event: 'IMPRESSIONS',
		status: 'PAUSED',
		targeting: targetingPayload(adSet)
	};
	// Conta com anunciante verificado: a Meta quer o ID da identidade (aceito na prática; os campos
	// de nome dsa_* não resolvem nesse caso). Sem ID, usa o nome do anunciante, se houver.
	const identityId = (spec.advertiserIdentityId || advertiserIdentityId || '').trim();
	if (identityId) {
		base.regional_regulation_identities = {
			universal_beneficiary: identityId,
			universal_payer: identityId
		};
	} else if (spec.advertiserName?.trim()) {
		base.dsa_beneficiary = spec.advertiserName.trim();
		base.dsa_payor = spec.advertiserName.trim();
	}
	if (spec.budgetMode === 'ABO') {
		base.daily_budget = adSet.dailyBudgetCents;
		base.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
	}
	const def = OBJECTIVES[spec.objective];
	const body = { ...base, optimization_goal: def.optimizationGoal };
	if (def.destinationType) body.destination_type = def.destinationType;
	const promoted = promotedObject(spec, def, pageId);
	if (promoted) body.promoted_object = promoted;
	return body;
}

function promotedObject(spec, def, pageId) {
	const d = spec.destination;
	switch (def.promoted) {
		case 'page':
			return { page_id: pageId };
		case 'pixel':
			return {
				pixel_id: d.pixelId.trim(),
				custom_event_type: (d.eventType || def.eventType).trim()
			};
		case 'app':
			return { application_id: d.appId.trim(), object_store_url: d.storeUrl.trim() };
		case 'catalog':
			return {
				product_set_id: d.productSetId.trim(),
				custom_event_type: (d.eventType || def.eventType).trim()
			};
		default:
			return null;
	}
}

function ctaPayload(spec, ad, pageId) {
	const d = spec.destination;
	switch (OBJECTIVES[spec.objective].creative) {
		case 'leadform':
			return {
				type: ad.cta,
				value: { lead_gen_form_id: d.leadFormId.trim(), link: 'http://fb.me/' }
			};
		case 'whatsapp':
			return {
				type: 'WHATSAPP_MESSAGE',
				value: { app_destination: 'WHATSAPP', link: 'https://api.whatsapp.com/send' }
			};
		case 'messenger':
			return { type: 'MESSAGE_PAGE', value: { app_destination: 'MESSENGER' } };
		case 'instagram_dm':
			return { type: 'INSTAGRAM_MESSAGE', value: { app_destination: 'INSTAGRAM_DIRECT' } };
		case 'profile':
			return {
				type: 'VIEW_INSTAGRAM_PROFILE',
				value: {
					link: `https://www.instagram.com/${d.instagramUsername.trim().replace(/^@/, '')}/`
				}
			};
		case 'page_like':
			return { type: 'LIKE_PAGE', value: { page: pageId } };
		case 'call':
			return { type: 'CALL_NOW', value: { link: `tel:${d.phone.replace(/[\s()-]/g, '')}` } };
		case 'app':
			return { type: ad.cta, value: { link: d.storeUrl.trim() } };
		case 'post':
			return { type: 'NO_BUTTON' };
		default:
			// Sem URL (alcance, vídeo), o anúncio aponta pra Página.
			return {
				type: ad.cta,
				value: { link: d.url.trim() || `https://www.facebook.com/${pageId}` }
			};
	}
}

/**
 * Criativo do anúncio. `asset` = { kind: 'IMAGE'|'VIDEO', imageHash?, videoId?, thumbnailUrl? }.
 */
export function creativePayload(spec, ad, asset, { pageId, igUserId }) {
	const def = OBJECTIVES[spec.objective];
	// Impulsionar publicação existente: o criativo é a própria publicação.
	if (def.creative === 'post') {
		const payload = { name: ad.name, object_story_id: spec.destination.postId.trim() };
		if (igUserId) payload.instagram_user_id = igUserId;
		return payload;
	}
	const cta = ctaPayload(spec, ad, pageId);
	const story = { page_id: pageId, ...(igUserId ? { instagram_user_id: igUserId } : {}) };
	const link = cta.value?.link ?? `https://www.facebook.com/${pageId}`;
	if (asset.kind === 'VIDEO') {
		story.video_data = {
			video_id: asset.videoId,
			message: ad.primaryText,
			title: ad.headline,
			...(ad.description ? { link_description: ad.description } : {}),
			...(cta.type === 'NO_BUTTON' ? {} : { call_to_action: cta }),
			...(asset.thumbnailUrl ? { image_url: asset.thumbnailUrl } : {})
		};
	} else {
		story.link_data = {
			image_hash: asset.imageHash,
			message: ad.primaryText,
			name: ad.headline,
			...(ad.description ? { description: ad.description } : {}),
			link,
			...(cta.type === 'NO_BUTTON' ? {} : { call_to_action: cta })
		};
	}
	const payload = { name: ad.name, object_story_spec: story };
	if (def.creative === 'catalog') {
		// Anúncio dinâmico do catálogo: a Meta monta os produtos a partir do conjunto.
		payload.product_set_id = spec.destination.productSetId.trim();
	}
	return payload;
}
