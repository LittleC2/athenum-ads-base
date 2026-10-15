import { describe, expect, it } from 'vitest';
import {
	adSetPayload,
	campaignPayload,
	creativePayload,
	emptySpec,
	OBJECTIVES,
	hasBlockingIssues,
	SpecSchema,
	targetingPayload,
	totalDailyBudgetCents,
	validateSpec
} from './campaignSpec.js';
import { ctasFor } from './objectives.js';
import { lintCopy } from './copyLint.js';

const account = { pageId: '100000000000011', maxDailyBudgetCents: 6000 };

function baseSpec(over = {}) {
	return SpecSchema.parse({
		campaignName: 'ATH - TESTE [WPP]',
		objective: 'LEADS_WHATSAPP',
		adSets: [
			{
				name: 'Mulheres Uberlândia',
				dailyBudgetCents: 3000,
				cities: [{ key: '273173', name: 'Uberlândia, MG', radiusKm: 25 }],
				ageMin: 25,
				ageMax: 55,
				genders: 'female',
				advantageAudience: true,
				ads: [
					{
						name: 'AD 1',
						assetId: 'a1',
						primaryText: 'Resultados naturais, com avaliação personalizada.',
						headline: 'Agende sua avaliação',
						cta: 'WHATSAPP_MESSAGE'
					}
				]
			}
		],
		...over
	});
}

describe('payloads reproduzem as campanhas reais que funcionam', () => {
	it('WhatsApp: conjunto igual ao da Clínica (CONVERSATIONS + destination WHATSAPP + page_id)', () => {
		const spec = baseSpec();
		const p = adSetPayload(spec, spec.adSets[0], { campaignId: 'c1', pageId: account.pageId });
		expect(p).toMatchObject({
			optimization_goal: 'CONVERSATIONS',
			destination_type: 'WHATSAPP',
			billing_event: 'IMPRESSIONS',
			status: 'PAUSED',
			promoted_object: { page_id: '100000000000011' },
			daily_budget: 3000
		});
		expect(p.targeting.targeting_automation).toEqual({ advantage_audience: 1 });
		expect(p.targeting.age_max).toBe(65);
		expect(p.targeting.age_range).toEqual([25, 55]);
		expect(p.targeting.genders).toEqual([2]);
		expect(p.targeting.geo_locations.cities[0]).toEqual({
			key: '273173',
			radius: 25,
			distance_unit: 'kilometer'
		});
	});

	it('Formulário: conjunto ON_AD com LEAD_GENERATION e criativo SIGN_UP com lead_gen_form_id', () => {
		const spec = baseSpec({
			objective: 'LEADS_FORM',
			destination: { leadFormId: '100000000000013', url: '' }
		});
		spec.adSets[0].ads[0].cta = 'SIGN_UP';
		const p = adSetPayload(spec, spec.adSets[0], { campaignId: 'c1', pageId: '100000000000012' });
		expect(p).toMatchObject({ optimization_goal: 'LEAD_GENERATION', destination_type: 'ON_AD' });
		const c = creativePayload(
			spec,
			spec.adSets[0].ads[0],
			{ kind: 'VIDEO', videoId: 'v1', thumbnailUrl: 'https://x/y.jpg' },
			{ pageId: '100000000000012', igUserId: '17841400000000012' }
		);
		expect(c.object_story_spec.instagram_user_id).toBe('17841400000000012');
		expect(c.object_story_spec.video_data.call_to_action).toEqual({
			type: 'SIGN_UP',
			value: { lead_gen_form_id: '100000000000013', link: 'http://fb.me/' }
		});
		expect(c.object_story_spec.video_data.image_url).toBe('https://x/y.jpg');
	});

	it('WhatsApp: criativo com WHATSAPP_MESSAGE e link api.whatsapp.com', () => {
		const spec = baseSpec();
		const c = creativePayload(
			spec,
			spec.adSets[0].ads[0],
			{ kind: 'IMAGE', imageHash: 'abc' },
			{ pageId: account.pageId }
		);
		expect(c.object_story_spec.link_data.call_to_action).toEqual({
			type: 'WHATSAPP_MESSAGE',
			value: { app_destination: 'WHATSAPP', link: 'https://api.whatsapp.com/send' }
		});
		expect(c.object_story_spec.link_data.image_hash).toBe('abc');
	});

	it('campanha nasce pausada; CBO leva orçamento e ABO desliga o compartilhamento', () => {
		const abo = campaignPayload(baseSpec());
		expect(abo).toMatchObject({
			objective: 'OUTCOME_LEADS',
			status: 'PAUSED',
			is_adset_budget_sharing_enabled: false
		});
		expect(abo.daily_budget).toBeUndefined();
		const cbo = campaignPayload(baseSpec({ budgetMode: 'CBO', campaignDailyBudgetCents: 5000 }));
		expect(cbo).toMatchObject({ daily_budget: 5000, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' });
		const adset = adSetPayload(
			baseSpec({ budgetMode: 'CBO', campaignDailyBudgetCents: 5000 }),
			baseSpec().adSets[0],
			{ campaignId: 'c', pageId: 'p' }
		);
		expect(adset.daily_budget).toBeUndefined();
	});

	it('sem Advantage+ respeita idade e posicionamentos exatos', () => {
		const spec = baseSpec();
		spec.adSets[0].advantageAudience = false;
		spec.adSets[0].placement = 'instagram_stories_reels';
		const t = targetingPayload(spec.adSets[0]);
		expect(t).toMatchObject({
			age_min: 25,
			age_max: 55,
			publisher_platforms: ['instagram'],
			instagram_positions: ['story', 'reels']
		});
		expect(t.age_range).toBeUndefined();
	});
});

describe('validateSpec', () => {
	it('spec correta passa; orçamento acima do teto bloqueia', () => {
		const ok = validateSpec(baseSpec(), account, { assetIds: new Set(['a1']) });
		expect(hasBlockingIssues(ok)).toBe(false);

		const over = baseSpec();
		over.adSets[0].dailyBudgetCents = 9000;
		const issues = validateSpec(over, account, { assetIds: new Set(['a1']) });
		expect(hasBlockingIssues(issues)).toBe(true);
		expect(issues.find((i) => /teto de segurança/.test(i.message))).toBeTruthy();
		expect(totalDailyBudgetCents(over)).toBe(9000);
	});

	it('exige página, formulário e criativo existente', () => {
		const form = baseSpec({ objective: 'LEADS_FORM' });
		form.adSets[0].ads[0].cta = 'SIGN_UP';
		const issues = validateSpec(
			form,
			{ pageId: null, maxDailyBudgetCents: null },
			{ assetIds: new Set() }
		);
		const msgs = issues.map((i) => i.message).join(' | ');
		expect(msgs).toMatch(/página do Facebook/);
		expect(msgs).toMatch(/ID do formulário/);
		expect(msgs).toMatch(/criativo não encontrado/);
	});

	it('avisa que Advantage+ ignora corte de gênero e idade', () => {
		const issues = validateSpec(baseSpec(), account, { assetIds: new Set(['a1']) });
		expect(issues.some((i) => i.level === 'warn' && /Advantage\+/.test(i.message))).toBe(true);
	});

	it('spec vazia ainda é válida pro editor', () => {
		const spec = emptySpec('TRAFFIC');
		expect(spec.adSets).toHaveLength(1);
		expect(hasBlockingIssues(validateSpec(spec, account))).toBe(true);
	});
});

describe('lintCopy', () => {
	it('pega promessa de saúde, atributo pessoal e travessão', () => {
		const flags = lintCopy({
			primaryText: 'Resultado 100% garantido. Você tem acne? Resolva rápido — agora!!',
			headline: 'Cura definitiva'
		});
		const codes = flags.map((f) => f.code);
		expect(codes).toContain('HEALTH_CLAIM');
		expect(codes).toContain('PERSONAL_ATTRIBUTE');
		expect(codes).toContain('DASH');
		expect(codes).toContain('PUNCTUATION');
	});

	it('texto limpo não gera alerta', () => {
		const flags = lintCopy({
			primaryText: 'Cuidado que respeita os seus traços, com avaliação personalizada.',
			headline: 'Agende sua avaliação'
		});
		expect(flags).toEqual([]);
	});
});

describe('schema pra IA', () => {
	it('SpecSchema vira JSON Schema de objeto sem quebrar', async () => {
		const { z } = await import('zod');
		const js = z.toJSONSchema(SpecSchema);
		expect(js.type).toBe('object');
		expect(js.properties.adSets.type).toBe('array');
		expect(js.properties.objective.enum).toEqual(Object.keys(OBJECTIVES));
	});
});

describe('rascunho incompleto', () => {
	it('salva anúncio sem criativo e a validação pede a escolha', () => {
		const spec = SpecSchema.parse({
			campaignName: 'x',
			objective: 'TRAFFIC',
			adSets: [
				{ name: 'c', ads: [{ name: 'AD 1', primaryText: '', headline: '', cta: 'LEARN_MORE' }] }
			]
		});
		expect(spec.adSets[0].ads[0].assetId).toBe('');
		const issues = validateSpec(
			spec,
			{ pageId: 'p', maxDailyBudgetCents: null },
			{ assetIds: new Set() }
		);
		expect(issues.some((i) => /escolha o criativo/.test(i.message))).toBe(true);
	});
});

describe('raio de cidade', () => {
	it('recusa raio menor que 17 km (limite de 10 milhas da Meta)', () => {
		const base = {
			campaignName: 'x',
			objective: 'TRAFFIC',
			adSets: [{ name: 'c', cities: [{ key: '1', name: 'A', radiusKm: 15 }] }]
		};
		expect(SpecSchema.safeParse(base).success).toBe(false);
		base.adSets[0].cities[0].radiusKm = 17;
		expect(SpecSchema.safeParse(base).success).toBe(true);
	});
});

describe('anunciante verificado', () => {
	it('usa o ID da identidade (conta ou spec) no lugar dos nomes dsa', () => {
		const spec = baseSpec({ advertiserName: 'Nome qualquer' });
		const withAccountId = adSetPayload(spec, spec.adSets[0], {
			campaignId: 'c',
			pageId: 'p',
			advertiserIdentityId: '123456789012345'
		});
		expect(withAccountId.regional_regulation_identities).toEqual({
			universal_beneficiary: '123456789012345',
			universal_payer: '123456789012345'
		});
		expect(withAccountId.dsa_beneficiary).toBeUndefined();
		const byName = adSetPayload(spec, spec.adSets[0], { campaignId: 'c', pageId: 'p' });
		expect(byName.dsa_beneficiary).toBe('Nome qualquer');
		expect(byName.regional_regulation_identities).toBeUndefined();
	});
});

describe('todos os objetivos da Meta', () => {
	const dest = {
		url: 'https://exemplo.com.br',
		leadFormId: '123',
		pixelId: '999',
		instagramUsername: 'exemplo',
		phone: '+5521999999999',
		appId: '555',
		storeUrl: 'https://apps.apple.com/app/x',
		catalogId: '77',
		productSetId: '88',
		postId: '1073_2'
	};
	const asset = { kind: 'IMAGE', imageHash: 'h' };

	for (const key of Object.keys(OBJECTIVES)) {
		it(`${key}: spec completa não tem erro e monta payloads`, () => {
			const def = OBJECTIVES[key];
			const cta = ctasFor(key)[0];
			const spec = baseSpec({ objective: key, destination: dest });
			spec.adSets[0].ads[0].cta = cta;
			const errors = validateSpec(spec, account, { assetIds: new Set(['a1']) }).filter(
				(i) => i.level === 'error'
			);
			expect(errors).toEqual([]);
			expect(campaignPayload(spec).objective).toBe(def.metaObjective);
			const adset = adSetPayload(spec, spec.adSets[0], { campaignId: 'c1', pageId: 'p1' });
			expect(adset.optimization_goal).toBe(def.optimizationGoal);
			expect(adset.destination_type).toBe(def.destinationType ?? undefined);
			expect(
				creativePayload(spec, spec.adSets[0].ads[0], asset, { pageId: 'p1', igUserId: 'ig' })
			).toBeTruthy();
		});

		it(`${key}: faltando dado obrigatório vira erro`, () => {
			const def = OBJECTIVES[key];
			if (!def.needs.length) return;
			const spec = baseSpec({ objective: key });
			spec.adSets[0].ads[0].cta = ctasFor(key)[0];
			const msgs = validateSpec(spec, account, { assetIds: new Set(['a1']) })
				.filter((i) => i.level === 'error')
				.map((i) => i.message)
				.join(' ');
			expect(msgs).toMatch(/Informe/);
		});
	}

	it('vendas no site usa pixel e evento de compra', () => {
		const spec = baseSpec({ objective: 'SALES_WEBSITE', destination: dest });
		const adset = adSetPayload(spec, spec.adSets[0], { campaignId: 'c1', pageId: 'p1' });
		expect(adset.promoted_object).toEqual({ pixel_id: '999', custom_event_type: 'PURCHASE' });
		expect(adset.destination_type).toBeUndefined();
	});

	it('objetivo só de vídeo recusa imagem', () => {
		const spec = baseSpec({ objective: 'ENGAGEMENT_VIDEO_VIEWS', destination: dest });
		spec.adSets[0].ads[0].cta = 'LEARN_MORE';
		const msgs = validateSpec(spec, account, {
			assetIds: new Set(['a1']),
			assetKinds: { a1: 'IMAGE' }
		}).map((i) => i.message);
		expect(msgs.join(' ')).toMatch(/precisa de vídeo/);
	});

	it('impulsionar publicação usa a publicação existente', () => {
		const spec = baseSpec({ objective: 'ENGAGEMENT_POST', destination: dest });
		const c = creativePayload(spec, spec.adSets[0].ads[0], asset, { pageId: 'p1', igUserId: '' });
		expect(c.object_story_id).toBe('1073_2');
	});
});
