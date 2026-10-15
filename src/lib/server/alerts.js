// Lê os números da conta, roda as regras e mantém a tabela Alert em dia
// (abre o que passou a valer, fecha o que parou de valer).
import { db } from './db.js';
import { evaluateAlerts } from '../alertRules.js';
import { addDays, fromDbDate, todayInSP, toDbDate } from '../dates.js';
import { liveInsights } from './meta/insights.js';

const toDayRow = (r) => ({
	date: fromDbDate(r.date),
	entityId: r.entityId,
	entityName: r.entityName,
	spendCents: r.spendCents,
	impressions: r.impressions,
	results: r.results,
	depth2: r.depth2,
	conversations: r.conversations
});

export async function refreshAlerts(account) {
	const today = todayInSP();
	const since = toDbDate(addDays(today, -75));

	const [campaignRows, adRows, entityRows] = await Promise.all([
		db.insightDaily.findMany({
			where: { accountId: account.id, level: 'CAMPAIGN', date: { gte: since } }
		}),
		db.insightDaily.findMany({
			where: { accountId: account.id, level: 'AD', date: { gte: toDbDate(addDays(today, -14)) } }
		}),
		db.metaEntity.findMany({ where: { accountId: account.id } })
	]);

	const entities = new Map(
		entityRows.map((e) => [
			e.externalId,
			{ effectiveStatus: e.effectiveStatus, name: e.name, level: e.level, objective: e.objective }
		])
	);

	let liveFreq = [];
	try {
		const live = await liveInsights(account, {
			since: addDays(today, -6),
			until: today,
			level: 'campaign'
		});
		liveFreq = live
			.filter((c) => entities.get(c.campaign_id)?.objective !== 'OUTCOME_AWARENESS')
			.map((c) => ({
				campaignId: c.campaign_id,
				name: c.campaign_name,
				frequency: Number(c.frequency ?? 0),
				spendCents: Math.round(Number(c.spend ?? 0) * 100)
			}));
	} catch {
		// Sem frequência ao vivo, as outras regras continuam valendo.
	}

	const current = evaluateAlerts({
		account,
		today,
		campaignDaily: campaignRows.map(toDayRow),
		adDaily: adRows.map(toDayRow),
		entities,
		liveFreq
	});

	const existing = await db.alert.findMany({ where: { accountId: account.id } });
	const byKey = new Map(existing.map((a) => [`${a.kind}|${a.entityId}`, a]));
	const now = new Date();
	const seen = new Set();

	for (const a of current) {
		const key = `${a.kind}|${a.entityId}`;
		seen.add(key);
		const data = {
			severity: a.severity,
			entityName: a.entityName,
			title: a.title,
			detail: a.detail,
			visibleToClient: a.visibleToClient,
			clientTitle: a.clientTitle ?? null,
			clientDetail: a.clientDetail ?? null,
			lastSeenAt: now
		};
		const prev = byKey.get(key);
		if (!prev) {
			await db.alert.create({
				data: { accountId: account.id, kind: a.kind, entityId: a.entityId, ...data }
			});
		} else if (prev.status === 'RESOLVED') {
			await db.alert.update({
				where: { id: prev.id },
				data: { ...data, status: 'OPEN', firstSeenAt: now, resolvedAt: null }
			});
		} else {
			await db.alert.update({ where: { id: prev.id }, data });
		}
	}

	for (const prev of existing) {
		if (!seen.has(`${prev.kind}|${prev.entityId}`) && prev.status !== 'RESOLVED') {
			await db.alert.update({
				where: { id: prev.id },
				data: { status: 'RESOLVED', resolvedAt: now }
			});
		}
	}
	return current.length;
}
