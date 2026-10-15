import { describe, expect, it } from 'vitest';
import { templateReport } from './reportTemplate.js';
import { cleanText, hasDash } from './text.js';

const facts = {
	clientName: 'Clínica Exemplo',
	resultType: 'WHATSAPP',
	since: '2026-10-06',
	until: '2026-10-12',
	cur: {
		spendCents: 19156,
		results: 22,
		costCents: 871,
		reach: 5499,
		frequency: 2.24,
		ctr: 1.8,
		cpmCents: 1557,
		depthRate: null
	},
	prev: { spendCents: 19197, results: 26, costCents: 738 },
	changes: { spend: -0.2, results: -15.4, cost: 18 },
	campaigns: [
		{ name: 'ATH LEADS', status: 'ACTIVE', spendCents: 19156, results: 22, costCents: 871 }
	],
	bestAds: [{ name: 'AD 3 vídeo', spendCents: 3071, results: 7, costCents: 439 }],
	worstAds: [{ name: 'AD 2 vídeo', spendCents: 1238, results: 0, costCents: null }],
	pacing: {
		spentCents: 32945,
		monthlyBudgetCents: 200000,
		projectedCents: 85108,
		status: 'abaixo'
	},
	alerts: [
		{
			severity: 'RED',
			kind: 'NO_RESULT_SPEND',
			title: 'Anúncio gastou R$ 54,89 sem resultado',
			detail: 'AD 2 vídeo',
			visibleToClient: false
		},
		{
			severity: 'YELLOW',
			kind: 'COST_RISING',
			title: 'Custo subiu',
			detail: 'x',
			visibleToClient: true
		}
	],
	feedback: null,
	targetCostCents: 1200
};

describe('templateReport', () => {
	const r = templateReport(facts);

	it('texto do cliente traz números, comparação e próximos passos sem jargão', () => {
		expect(r.clientSummary).toMatch(/R\$\s?191,56/);
		expect(r.clientSummary).toMatch(/22 conversas no WhatsApp/);
		expect(r.clientSummary).toMatch(/26 conversas/);
		expect(r.clientSummary).toMatch(/Próximos passos/);
		expect(r.clientSummary).toMatch(/Resultados/);
		expect(r.clientSummary).not.toMatch(/CPM|CTR|frequência/i);
	});

	it('nunca usa travessão', () => {
		expect(hasDash(r.clientSummary)).toBe(false);
		expect(hasDash(r.internalAnalysis)).toBe(false);
	});

	it('análise interna lista alertas e piores anúncios', () => {
		expect(r.internalAnalysis).toMatch(/Piores anúncios/);
		expect(r.internalAnalysis).toMatch(/Atenção: Anúncio gastou/);
	});

	it('recomendações priorizam o que gasta sem resultado', () => {
		expect(r.recommendations[0].priority).toBe('alta');
		expect(r.recommendations.some((x) => /vendas|venda/i.test(x.action))).toBe(true);
	});

	it('com retorno do cliente calcula o custo por cliente', () => {
		const withSales = templateReport({
			...facts,
			feedback: { qualified: 10, sales: 4, revenueCents: null }
		});
		expect(withSales.clientSummary).toMatch(/R\$\s?47,89/);
	});
});

describe('cleanText', () => {
	it('troca travessão por vírgula e meia-risca por "a"', () => {
		expect(cleanText('Rápido — simples')).toBe('Rápido, simples');
		expect(cleanText('de 10 – 20')).toBe('de 10 a 20');
	});
});

describe('comparação sem variação', () => {
	it('não escreve "0% mais resultados"', () => {
		const same = templateReport({
			...facts,
			prev: { ...facts.prev, results: 22 },
			changes: { spend: 0, results: 0, cost: 5 }
		});
		expect(same.clientSummary).toMatch(/o mesmo número de resultados/);
		expect(same.clientSummary).not.toMatch(/0% mais/);
	});
});
