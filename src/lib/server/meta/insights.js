// Sincronização dos números da Meta pro banco (por dia) e consultas ao vivo
// com cache curto (alcance e frequência não se somam entre dias).
import { db, TX_OPTIONS } from '../db.js';
import { paginate, withAccountToken } from './client.js';
import { addDays, diffDays, toDbDate } from '../../dates.js';
import { normalizeRow } from '../../metrics.js';

const BASE_FIELDS = 'spend,impressions,clicks,inline_link_clicks,actions';
const LEVEL_FIELDS = {
	CAMPAIGN: 'campaign_id,campaign_name',
	ADSET: 'campaign_id,adset_id,adset_name',
	AD: 'campaign_id,adset_id,ad_id,ad_name'
};
const LEVEL_PARAM = { CAMPAIGN: 'campaign', ADSET: 'adset', AD: 'ad' };
const WINDOW_DAYS = 30;

function entityFromRow(level, row) {
	if (level === 'CAMPAIGN') {
		return {
			entityId: row.campaign_id,
			entityName: row.campaign_name,
			campaignId: row.campaign_id,
			adsetId: null
		};
	}
	if (level === 'ADSET') {
		return {
			entityId: row.adset_id,
			entityName: row.adset_name,
			campaignId: row.campaign_id,
			adsetId: row.adset_id
		};
	}
	return {
		entityId: row.ad_id,
		entityName: row.ad_name,
		campaignId: row.campaign_id,
		adsetId: row.adset_id
	};
}

/**
 * Reescreve os números diários de [since, until] pra conta, nos 3 níveis.
 * Apagar a janela antes de gravar garante que correções de atribuição da
 * Meta (a mesma data muda depois) entrem sem duplicar.
 */
export async function syncInsights(account, since, until) {
	let written = 0;
	for (let start = since; start <= until; start = addDays(start, WINDOW_DAYS)) {
		const end = addDays(start, WINDOW_DAYS - 1) > until ? until : addDays(start, WINDOW_DAYS - 1);
		for (const level of ['CAMPAIGN', 'ADSET', 'AD']) {
			const rows = await paginate(`${account.externalId}/insights`, {
				level: LEVEL_PARAM[level],
				time_increment: 1,
				time_range: { since: start, until: end },
				fields: `${LEVEL_FIELDS[level]},${BASE_FIELDS}`
			});
			const data = rows
				.map((row) => {
					const ent = entityFromRow(level, row);
					if (!ent.entityId) return null;
					const n = normalizeRow(row, account.resultType);
					return {
						accountId: account.id,
						level,
						...ent,
						date: toDbDate(row.date_start),
						spendCents: n.spendCents,
						impressions: n.impressions,
						clicks: n.clicks,
						linkClicks: n.linkClicks,
						results: n.results,
						conversations: n.conversations,
						depth2: n.depth2,
						actions: n.actions
					};
				})
				.filter(Boolean);
			await db.$transaction(
				[
					db.insightDaily.deleteMany({
						where: {
							accountId: account.id,
							level,
							date: { gte: toDbDate(start), lte: toDbDate(end) }
						}
					}),
					db.insightDaily.createMany({ data })
				],
				TX_OPTIONS
			);
			written += data.length;
		}
	}
	return written;
}

/** Recalcula `results` a partir das ações guardadas (quando muda o tipo de resultado da conta). */
export async function recomputeResults(account) {
	const rows = await db.insightDaily.findMany({
		where: { accountId: account.id },
		select: { id: true, actions: true }
	});
	let n = 0;
	for (const row of rows) {
		const actions = Object.entries(row.actions ?? {}).map(([action_type, value]) => ({
			action_type,
			value
		}));
		const { results } = normalizeRow({ actions }, account.resultType);
		await db.insightDaily.update({ where: { id: row.id }, data: { results } });
		n++;
	}
	return n;
}

const LIVE_TTL_MS = 20 * 60 * 1000;

/**
 * Consulta ao vivo (alcance/frequência exatos do período, quebras por idade,
 * posicionamento, etc.). Resposta guardada por 20 minutos.
 * @param {{ since: string, until: string, level?: string, breakdowns?: string, fields?: string }} opts
 */
export async function liveInsights(
	account,
	{ since, until, level = 'account', breakdowns, fields }
) {
	const key = `${account.id}|${level}|${since}|${until}|${breakdowns ?? ''}|${fields ?? ''}`;
	const cached = await db.insightCache.findUnique({ where: { key } });
	if (cached && Date.now() - cached.fetchedAt.getTime() < LIVE_TTL_MS) return cached.payload;

	const levelFields =
		level === 'campaign'
			? 'campaign_id,campaign_name,'
			: level === 'ad'
				? 'ad_id,ad_name,adset_id,campaign_id,'
				: '';
	const rows = await withAccountToken(account, () =>
		paginate(`${account.externalId}/insights`, {
			level,
			time_range: { since, until },
			breakdowns,
			fields: fields ?? `${levelFields}${BASE_FIELDS},reach,frequency,cpm`
		})
	);
	await db.insightCache.upsert({
		where: { key },
		update: { payload: rows, fetchedAt: new Date() },
		create: { key, payload: rows }
	});
	return rows;
}

export function daysBetween(since, until) {
	return diffDays(since, until) + 1;
}
