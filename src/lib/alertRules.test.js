import { describe, expect, it } from 'vitest';
import { evaluateAlerts } from './alertRules.js';
import { addDays } from './dates.js';

const TODAY = '2026-10-12';

function days(from, to, make) {
	const rows = [];
	for (let d = from; d <= to; d = addDays(d, 1)) rows.push(make(d));
	return rows;
}

const base = {
	account: { resultType: 'WHATSAPP', targetCostCents: 1200, monthlyBudgetCents: 200000 },
	today: TODAY,
	entities: new Map()
};

describe('evaluateAlerts', () => {
	it('alerta quando o custo por resultado sobe mais de 30% e mostra versão pro cliente', () => {
		const campaignDaily = [
			...days('2026-09-29', '2026-10-05', (date) => ({
				date,
				entityId: 'c1',
				entityName: 'Leads',
				spendCents: 2000,
				impressions: 1000,
				results: 3,
				depth2: 1,
				conversations: 3
			})),
			...days('2026-10-06', '2026-10-12', (date) => ({
				date,
				entityId: 'c1',
				entityName: 'Leads',
				spendCents: 2000,
				impressions: 1000,
				results: 2,
				depth2: 1,
				conversations: 2
			}))
		];
		const alerts = evaluateAlerts({ ...base, campaignDaily, adDaily: [] });
		const rising = alerts.find((a) => a.kind === 'COST_RISING');
		expect(rising).toBeTruthy();
		expect(rising.visibleToClient).toBe(true);
		expect(rising.clientDetail).toMatch(/R\$/);
	});

	it('não alerta com poucos resultados no período anterior', () => {
		const campaignDaily = days('2026-10-06', '2026-10-12', (date) => ({
			date,
			entityId: 'c1',
			entityName: 'Leads',
			spendCents: 2000,
			impressions: 1000,
			results: 2,
			depth2: 0,
			conversations: 2
		}));
		const alerts = evaluateAlerts({ ...base, campaignDaily, adDaily: [] });
		expect(alerts.find((a) => a.kind === 'COST_RISING')).toBeUndefined();
	});

	it('marca em vermelho anúncio ativo que gastou sem resultado', () => {
		const adDaily = days('2026-10-01', '2026-10-12', (date) => ({
			date,
			entityId: 'ad1',
			entityName: 'Vídeo 2',
			spendCents: 500,
			impressions: 200,
			results: 0,
			depth2: 0,
			conversations: 0
		}));
		const entities = new Map([
			['ad1', { effectiveStatus: 'ACTIVE', name: 'Vídeo 2', level: 'AD' }]
		]);
		const alerts = evaluateAlerts({ ...base, campaignDaily: [], adDaily, entities });
		const a = alerts.find((x) => x.kind === 'NO_RESULT_SPEND');
		expect(a.severity).toBe('RED');
		expect(a.visibleToClient).toBe(false);
	});

	it('ignora anúncio pausado mesmo que tenha gasto sem resultado', () => {
		const adDaily = days('2026-10-01', '2026-10-12', (date) => ({
			date,
			entityId: 'ad1',
			entityName: 'Vídeo 2',
			spendCents: 500,
			impressions: 200,
			results: 0,
			depth2: 0,
			conversations: 0
		}));
		const entities = new Map([
			['ad1', { effectiveStatus: 'PAUSED', name: 'Vídeo 2', level: 'AD' }]
		]);
		const noBudget = { ...base.account, monthlyBudgetCents: null };
		expect(
			evaluateAlerts({ ...base, account: noBudget, campaignDaily: [], adDaily, entities })
		).toEqual([]);
	});

	it('frequência acima de 4 é vermelha e acima de 3 é amarela', () => {
		const alerts = evaluateAlerts({
			...base,
			campaignDaily: [],
			adDaily: [],
			liveFreq: [
				{ campaignId: 'a', name: 'A', frequency: 4.4, spendCents: 20000 },
				{ campaignId: 'b', name: 'B', frequency: 3.2, spendCents: 20000 },
				{ campaignId: 'c', name: 'C', frequency: 5, spendCents: 100 }
			]
		});
		const freq = alerts.filter((a) => a.kind === 'FREQUENCY_HIGH');
		expect(freq.map((a) => [a.entityId, a.severity])).toEqual([
			['a', 'RED'],
			['b', 'YELLOW']
		]);
	});

	it('detecta queda de profundidade de conversa', () => {
		const campaignDaily = [
			...days('2026-08-31', '2026-09-28', (date) => ({
				date,
				entityId: 'c1',
				entityName: 'L',
				spendCents: 3000,
				impressions: 1000,
				results: 3,
				depth2: 1,
				conversations: 3
			})),
			...days('2026-09-29', '2026-10-12', (date) => ({
				date,
				entityId: 'c1',
				entityName: 'L',
				spendCents: 3000,
				impressions: 1000,
				results: 3,
				depth2: 0,
				conversations: 3
			}))
		];
		const alerts = evaluateAlerts({
			...base,
			account: { ...base.account, resultType: 'LEAD_FORM' },
			campaignDaily,
			adDaily: []
		});
		expect(alerts.find((a) => a.kind === 'DEPTH_DROP')?.severity).toBe('RED');
	});

	it('ordena vermelho, amarelo e verde', () => {
		const adDaily = days('2026-10-01', '2026-10-12', (date) => ({
			date,
			entityId: 'ad1',
			entityName: 'X',
			spendCents: 500,
			impressions: 200,
			results: 0,
			depth2: 0,
			conversations: 0
		}));
		const entities = new Map([['ad1', { effectiveStatus: 'ACTIVE', name: 'X', level: 'AD' }]]);
		const alerts = evaluateAlerts({
			...base,
			campaignDaily: [],
			adDaily,
			entities,
			liveFreq: [{ campaignId: 'b', name: 'B', frequency: 3.5, spendCents: 20000 }]
		});
		expect(alerts[0].severity).toBe('RED');
		expect(alerts.at(-1).severity).not.toBe('RED');
	});
});
