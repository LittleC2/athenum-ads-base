import { describe, expect, it } from 'vitest';
import { activityOf, bestDay, costSeries, funnelOf, healthOf, weekdayOf } from './story.js';

const account = { resultType: 'WHATSAPP', targetCostCents: 1000 };
const series = [
	{ date: '2026-10-10', spendCents: 1000, results: 2 },
	{ date: '2026-10-11', spendCents: 1000, results: 5 },
	{ date: '2026-10-12', spendCents: 1000, results: 0 }
];
function dash(over = {}) {
	return {
		today: '2026-10-12',
		series,
		campaigns: [{ status: 'ACTIVE' }],
		ads: [{ name: 'AD 1', results: 5 }],
		pacing: null,
		changes: { results: 20, cost: -10, spend: 0 },
		cur: { spendCents: 3000, results: 7, costCents: 428, reach: 900, linkClicks: 120, clicks: 150 },
		...over
	};
}

describe('story', () => {
	it('dia da semana', () => expect(weekdayOf('2026-10-12')).toBe('segunda'));
	it('melhor dia', () => expect(bestDay(series)).toMatchObject({ date: '2026-10-11', results: 5 }));
	it('custo por dia repete o último', () =>
		expect(costSeries(series)[2]).toBe(costSeries(series)[1]));

	it('conta saudável', () => {
		const h = healthOf({ account, dashboard: dash() });
		expect(h.level).toBe('good');
		expect(h.detail).toContain('7 conversas no WhatsApp');
		expect(h.detail).toContain('20% a mais');
	});
	it('custo acima da meta pede atenção', () => {
		const h = healthOf({
			account,
			dashboard: dash({ cur: { ...dash().cur, costCents: 1500 } })
		});
		expect(h.level).toBe('bad');
	});
	it('sem gasto é ocioso e sem resultado avisa', () => {
		expect(
			healthOf({ account, dashboard: dash({ cur: { spendCents: 0, results: 0 } }) }).level
		).toBe('idle');
		const h = healthOf({
			account,
			dashboard: dash({ cur: { spendCents: 9000, results: 0, costCents: null } })
		});
		expect(h.level).toBe('bad');
	});
	it('funil só tem etapas com dado', () => {
		const f = funnelOf({ account, dashboard: dash(), feedback: { sales: 2 } });
		expect(f.map((s) => s.key)).toEqual(['reach', 'clicks', 'results', 'sales']);
		expect(funnelOf({ account, dashboard: dash({ cur: { results: 1 } }) })).toHaveLength(1);
	});
	it('linha do tempo em frases', () => {
		const a = activityOf({ account, dashboard: dash(), feedbackDue: true });
		expect(a.some((i) => i.text.startsWith('Hoje:'))).toBe(true);
		expect(a.some((i) => i.icon === 'ask')).toBe(true);
	});
});
