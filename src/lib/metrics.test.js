import { describe, expect, it } from 'vitest';
import {
	budgetPacing,
	costPerResult,
	depthRate,
	normalizeRow,
	pctChange,
	sumRows
} from './metrics.js';
import { addDays, daysInMonth, monthEnd, periodFromPreset } from './dates.js';
import { brl, signedPct } from './format.js';

describe('normalizeRow', () => {
	const row = {
		spend: '507.64',
		impressions: '26201',
		clicks: '472',
		inline_link_clicks: '218',
		actions: [
			{ action_type: 'lead', value: '3' },
			{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '55' },
			{ action_type: 'onsite_conversion.messaging_user_depth_2_message_send', value: '26' }
		]
	};

	it('converte gasto em centavos sem erro de ponto flutuante', () => {
		expect(normalizeRow(row, 'WHATSAPP').spendCents).toBe(50764);
		expect(normalizeRow({ spend: '0.29' }, 'LEAD_FORM').spendCents).toBe(29);
	});

	it('escolhe a ação de resultado pelo tipo da conta', () => {
		expect(normalizeRow(row, 'WHATSAPP').results).toBe(55);
		expect(normalizeRow(row, 'LEAD_FORM').results).toBe(3);
		expect(normalizeRow(row, 'WHATSAPP').depth2).toBe(26);
	});

	it('aceita linha sem ações', () => {
		const n = normalizeRow({ spend: '1.00', impressions: '10', clicks: '1' }, 'LEAD_FORM');
		expect(n.results).toBe(0);
		expect(n.linkClicks).toBe(0);
	});
});

describe('contas do cliente', () => {
	it('soma linhas e calcula custo por resultado', () => {
		const total = sumRows([
			{ spendCents: 12411, results: 7 },
			{ spendCents: 19197, results: 26 }
		]);
		expect(total.spendCents).toBe(31608);
		expect(costPerResult(total.spendCents, total.results)).toBe(958);
		expect(costPerResult(100, 0)).toBeNull();
	});

	it('variação percentual', () => {
		expect(pctChange(8.71, 7.38)).toBeCloseTo(18.02, 1);
		expect(pctChange(5, 0)).toBeNull();
	});

	it('taxa de profundidade', () => {
		expect(depthRate(26, 55)).toBeCloseTo(47.27, 1);
		expect(depthRate(1, 0)).toBeNull();
	});
});

describe('budgetPacing', () => {
	it('projeta o mês e classifica o ritmo', () => {
		const p = budgetPacing({
			spentCents: 32945,
			monthlyBudgetCents: 200000,
			dayOfMonth: 12,
			daysInMonth: 31
		});
		expect(p.projectedCents).toBe(85108);
		expect(p.status).toBe('abaixo');
		const over = budgetPacing({
			spentCents: 100000,
			monthlyBudgetCents: 200000,
			dayOfMonth: 10,
			daysInMonth: 30
		});
		expect(over.status).toBe('acima');
		expect(
			budgetPacing({ spentCents: 1, monthlyBudgetCents: null, dayOfMonth: 1, daysInMonth: 30 })
		).toBeNull();
	});
});

describe('datas', () => {
	it('soma dias atravessando meses e anos', () => {
		expect(addDays('2026-10-12', -6)).toBe('2026-10-06');
		expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
		expect(monthEnd('2026-02-10')).toBe('2026-02-28');
		expect(daysInMonth('2026-10-12')).toBe(31);
	});

	it('períodos e comparativos', () => {
		const p7 = periodFromPreset('7d', '2026-10-12');
		expect(p7).toMatchObject({
			since: '2026-10-06',
			until: '2026-10-12',
			prevSince: '2026-09-29',
			prevUntil: '2026-10-05'
		});
		const month = periodFromPreset('month', '2026-10-12');
		expect(month).toMatchObject({
			since: '2026-10-01',
			prevSince: '2026-09-01',
			prevUntil: '2026-09-12'
		});
		const last = periodFromPreset('lastmonth', '2026-10-12');
		expect(last).toMatchObject({
			since: '2026-09-01',
			until: '2026-09-30',
			prevSince: '2026-08-01',
			prevUntil: '2026-08-31'
		});
		const march = periodFromPreset('month', '2026-03-31');
		expect(march.prevUntil).toBe('2026-02-28');
	});
});

describe('formatação', () => {
	it('moeda e variação em pt-BR', () => {
		expect(brl(50764).replace(/\s/g, ' ')).toBe('R$ 507,64');
		expect(signedPct(12.34)).toBe('+12,3%');
		expect(signedPct(-5)).toBe('-5,0%');
	});
});
