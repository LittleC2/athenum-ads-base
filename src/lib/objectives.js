// Catálogo de objetivos de campanha da Meta (os 6 objetivos ODAX e suas variações por
// local de conversão). Cada entrada diz tudo que muda: objetivo da Meta, meta de
// otimização, tipo de destino, o que vai em promoted_object, como é o criativo e quais
// dados o gestor precisa informar. Os valores foram conferidos contra as campanhas
// reais das contas (ver scripts/objective-survey.js). Módulo puro.

/**
 * @typedef {'page'|'pixel'|'app'|'catalog'|null} PromotedKind
 * @typedef {'website'|'leadform'|'whatsapp'|'messenger'|'instagram_dm'|'profile'|'page_like'|'call'|'app'|'post'|'catalog'} CreativeKind
 * @typedef {{
 *   label: string, group: string, metaObjective: string, optimizationGoal: string,
 *   destinationType: string|null, promoted: PromotedKind, eventType?: string,
 *   creative: CreativeKind, needs: string[], videoOnly?: boolean, experimental?: boolean
 * }} ObjectiveDef
 */

export const GROUPS = {
	AWARENESS: 'Reconhecimento',
	TRAFFIC: 'Tráfego',
	ENGAGEMENT: 'Engajamento',
	LEADS: 'Cadastros (leads)',
	SALES: 'Vendas',
	APP: 'Promoção do app'
};

/** @type {Record<string, ObjectiveDef>} */
export const OBJECTIVES = {
	// --- Reconhecimento ---------------------------------------------------------
	AWARENESS_REACH: {
		label: 'Alcance',
		group: 'AWARENESS',
		metaObjective: 'OUTCOME_AWARENESS',
		optimizationGoal: 'REACH',
		destinationType: null,
		promoted: 'page',
		creative: 'website',
		needs: []
	},
	AWARENESS_VIDEO: {
		label: 'Reconhecimento com vídeo (ThruPlay)',
		group: 'AWARENESS',
		metaObjective: 'OUTCOME_AWARENESS',
		optimizationGoal: 'THRUPLAY',
		destinationType: null,
		promoted: 'page',
		creative: 'website',
		needs: [],
		videoOnly: true
	},

	// --- Tráfego -----------------------------------------------------------------
	TRAFFIC: {
		label: 'Tráfego para o site',
		group: 'TRAFFIC',
		metaObjective: 'OUTCOME_TRAFFIC',
		optimizationGoal: 'LINK_CLICKS',
		destinationType: 'WEBSITE',
		promoted: null,
		creative: 'website',
		needs: ['url']
	},
	TRAFFIC_LPV: {
		label: 'Tráfego para o site (visualizações da página)',
		group: 'TRAFFIC',
		metaObjective: 'OUTCOME_TRAFFIC',
		optimizationGoal: 'LANDING_PAGE_VIEWS',
		destinationType: 'WEBSITE',
		promoted: null,
		creative: 'website',
		needs: ['url']
	},
	TRAFFIC_INSTAGRAM_PROFILE: {
		label: 'Tráfego para o perfil do Instagram',
		group: 'TRAFFIC',
		metaObjective: 'OUTCOME_TRAFFIC',
		optimizationGoal: 'PROFILE_VISIT',
		destinationType: 'INSTAGRAM_PROFILE',
		promoted: 'page',
		creative: 'profile',
		needs: ['instagramUsername']
	},
	TRAFFIC_WHATSAPP: {
		label: 'Tráfego para o WhatsApp',
		group: 'TRAFFIC',
		metaObjective: 'OUTCOME_TRAFFIC',
		optimizationGoal: 'CONVERSATIONS',
		destinationType: 'WHATSAPP',
		promoted: 'page',
		creative: 'whatsapp',
		needs: []
	},

	// --- Engajamento --------------------------------------------------------------
	ENGAGEMENT_WHATSAPP: {
		label: 'Engajamento: conversas no WhatsApp',
		group: 'ENGAGEMENT',
		metaObjective: 'OUTCOME_ENGAGEMENT',
		optimizationGoal: 'CONVERSATIONS',
		destinationType: 'WHATSAPP',
		promoted: 'page',
		creative: 'whatsapp',
		needs: []
	},
	ENGAGEMENT_MESSENGER: {
		label: 'Engajamento: conversas no Messenger',
		group: 'ENGAGEMENT',
		metaObjective: 'OUTCOME_ENGAGEMENT',
		optimizationGoal: 'CONVERSATIONS',
		destinationType: 'MESSENGER',
		promoted: 'page',
		creative: 'messenger',
		needs: []
	},
	ENGAGEMENT_INSTAGRAM_DM: {
		label: 'Engajamento: conversas no Direct do Instagram',
		group: 'ENGAGEMENT',
		metaObjective: 'OUTCOME_ENGAGEMENT',
		optimizationGoal: 'CONVERSATIONS',
		destinationType: 'INSTAGRAM_DIRECT',
		promoted: 'page',
		creative: 'instagram_dm',
		needs: []
	},
	ENGAGEMENT_VIDEO_VIEWS: {
		label: 'Engajamento: visualizações de vídeo (ThruPlay)',
		group: 'ENGAGEMENT',
		metaObjective: 'OUTCOME_ENGAGEMENT',
		optimizationGoal: 'THRUPLAY',
		destinationType: 'ON_VIDEO',
		promoted: null,
		creative: 'website',
		needs: [],
		videoOnly: true
	},
	ENGAGEMENT_POST: {
		label: 'Engajamento: impulsionar publicação da Página',
		group: 'ENGAGEMENT',
		metaObjective: 'OUTCOME_ENGAGEMENT',
		optimizationGoal: 'POST_ENGAGEMENT',
		destinationType: 'ON_POST',
		promoted: 'page',
		creative: 'post',
		needs: ['postId'],
		experimental: true
	},
	ENGAGEMENT_PAGE_LIKES: {
		label: 'Engajamento: curtidas na Página',
		group: 'ENGAGEMENT',
		metaObjective: 'OUTCOME_ENGAGEMENT',
		optimizationGoal: 'PAGE_LIKES',
		destinationType: 'ON_PAGE',
		promoted: 'page',
		creative: 'page_like',
		needs: []
	},

	// --- Leads ---------------------------------------------------------------------
	LEADS_FORM: {
		label: 'Leads com formulário',
		group: 'LEADS',
		metaObjective: 'OUTCOME_LEADS',
		optimizationGoal: 'LEAD_GENERATION',
		destinationType: 'ON_AD',
		promoted: 'page',
		creative: 'leadform',
		needs: ['leadFormId']
	},
	LEADS_WHATSAPP: {
		label: 'Leads: conversas no WhatsApp',
		group: 'LEADS',
		metaObjective: 'OUTCOME_LEADS',
		optimizationGoal: 'CONVERSATIONS',
		destinationType: 'WHATSAPP',
		promoted: 'page',
		creative: 'whatsapp',
		needs: []
	},
	// Messenger e Direct com objetivo de leads: a Meta recusa (usar Engajamento ou Vendas).
	LEADS_WEBSITE: {
		label: 'Leads no site (pixel)',
		group: 'LEADS',
		metaObjective: 'OUTCOME_LEADS',
		optimizationGoal: 'OFFSITE_CONVERSIONS',
		destinationType: 'WEBSITE',
		promoted: 'pixel',
		eventType: 'LEAD',
		creative: 'website',
		needs: ['url', 'pixelId']
	},
	LEADS_CALLS: {
		label: 'Leads: ligações',
		group: 'LEADS',
		metaObjective: 'OUTCOME_LEADS',
		optimizationGoal: 'QUALITY_CALL',
		destinationType: 'PHONE_CALL',
		promoted: 'page',
		creative: 'call',
		needs: ['phone']
	},

	// --- Vendas -----------------------------------------------------------------------
	SALES_WEBSITE: {
		label: 'Vendas no site (pixel)',
		group: 'SALES',
		metaObjective: 'OUTCOME_SALES',
		optimizationGoal: 'OFFSITE_CONVERSIONS',
		destinationType: null,
		promoted: 'pixel',
		eventType: 'PURCHASE',
		creative: 'website',
		needs: ['url', 'pixelId']
	},
	SALES_WHATSAPP: {
		label: 'Vendas: conversas no WhatsApp',
		group: 'SALES',
		metaObjective: 'OUTCOME_SALES',
		optimizationGoal: 'CONVERSATIONS',
		destinationType: 'WHATSAPP',
		promoted: 'page',
		creative: 'whatsapp',
		needs: []
	},
	SALES_MESSENGER: {
		label: 'Vendas: conversas no Messenger',
		group: 'SALES',
		metaObjective: 'OUTCOME_SALES',
		optimizationGoal: 'CONVERSATIONS',
		destinationType: 'MESSENGER',
		promoted: 'page',
		creative: 'messenger',
		needs: []
	},
	SALES_INSTAGRAM_DM: {
		label: 'Vendas: conversas no Direct do Instagram',
		group: 'SALES',
		metaObjective: 'OUTCOME_SALES',
		optimizationGoal: 'CONVERSATIONS',
		destinationType: 'INSTAGRAM_DIRECT',
		promoted: 'page',
		creative: 'instagram_dm',
		needs: []
	},
	SALES_CATALOG: {
		label: 'Vendas com catálogo de produtos',
		group: 'SALES',
		metaObjective: 'OUTCOME_SALES',
		optimizationGoal: 'OFFSITE_CONVERSIONS',
		destinationType: null,
		promoted: 'catalog',
		eventType: 'PURCHASE',
		creative: 'catalog',
		needs: ['url', 'pixelId', 'catalogId', 'productSetId'],
		experimental: true
	},

	// --- App ------------------------------------------------------------------------------
	APP_INSTALLS: {
		label: 'Instalações do app',
		group: 'APP',
		metaObjective: 'OUTCOME_APP_PROMOTION',
		optimizationGoal: 'APP_INSTALLS',
		destinationType: 'APP',
		promoted: 'app',
		creative: 'app',
		needs: ['appId', 'storeUrl'],
		experimental: true
	}
};

export const OBJECTIVE_KEYS = /** @type {[string, ...string[]]} */ (Object.keys(OBJECTIVES));

/** Botões permitidos por tipo de criativo (valores de call_to_action da Meta). */
export const CTAS_BY_CREATIVE = {
	website: [
		'LEARN_MORE',
		'SHOP_NOW',
		'ORDER_NOW',
		'SIGN_UP',
		'GET_OFFER',
		'GET_QUOTE',
		'CONTACT_US',
		'BOOK_TRAVEL',
		'APPLY_NOW',
		'SUBSCRIBE',
		'NO_BUTTON'
	],
	leadform: ['SIGN_UP', 'LEARN_MORE', 'GET_QUOTE', 'APPLY_NOW', 'SUBSCRIBE', 'GET_OFFER'],
	whatsapp: ['WHATSAPP_MESSAGE'],
	messenger: ['MESSAGE_PAGE'],
	instagram_dm: ['INSTAGRAM_MESSAGE'],
	profile: ['VIEW_INSTAGRAM_PROFILE'],
	page_like: ['LIKE_PAGE'],
	call: ['CALL_NOW'],
	app: ['INSTALL_MOBILE_APP', 'USE_APP', 'PLAY_GAME'],
	post: ['NO_BUTTON'],
	catalog: ['SHOP_NOW', 'LEARN_MORE', 'ORDER_NOW']
};

/** Botões permitidos pra um objetivo. */
export function ctasFor(objectiveKey) {
	return CTAS_BY_CREATIVE[OBJECTIVES[objectiveKey]?.creative] ?? ['LEARN_MORE'];
}

/** Rótulos amigáveis dos dados extras que cada objetivo pede. */
export const NEED_LABELS = {
	url: 'URL de destino (https://...)',
	leadFormId: 'ID do formulário de leads',
	pixelId: 'ID do pixel da Meta',
	instagramUsername: 'Usuário do Instagram (sem @)',
	phone: 'Telefone com DDI (ex: +5521999999999)',
	appId: 'ID do app na Meta',
	storeUrl: 'URL da loja de apps (App Store ou Google Play)',
	catalogId: 'ID do catálogo de produtos',
	productSetId: 'ID do conjunto de produtos',
	postId: 'ID da publicação (pagina_publicacao)'
};

/** Objetivos agrupados pra montar o seletor. */
export function objectivesByGroup() {
	return Object.entries(GROUPS).map(([group, label]) => ({
		group,
		label,
		items: Object.entries(OBJECTIVES)
			.filter(([, d]) => d.group === group)
			.map(([key, d]) => ({ key, label: d.label, experimental: Boolean(d.experimental) }))
	}));
}
