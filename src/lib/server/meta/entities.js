// Cache local de campanhas, conjuntos e anúncios (nome, status, orçamento).
import { db, TX_OPTIONS } from '../db.js';
import { paginate } from './client.js';

const CAMPAIGN_FIELDS = 'id,name,status,effective_status,objective,daily_budget,created_time';
const ADSET_FIELDS = 'id,name,campaign_id,status,effective_status,daily_budget,created_time';
const AD_FIELDS =
	'id,name,adset_id,campaign_id,status,effective_status,created_time,creative{thumbnail_url}';

const cents = (v) => (v != null && v !== '' ? Number(v) : null);

/** Troca o cache de entidades da conta pelo que está hoje na Meta. */
export async function syncEntities(account) {
	const act = account.externalId;
	const [campaigns, adsets, ads] = await Promise.all([
		paginate(`${act}/campaigns`, { fields: CAMPAIGN_FIELDS }),
		paginate(`${act}/adsets`, { fields: ADSET_FIELDS }),
		paginate(`${act}/ads`, { fields: AD_FIELDS })
	]);

	const base = { accountId: account.id };
	const rows = [
		...campaigns.map((c) => ({
			...base,
			level: 'CAMPAIGN',
			externalId: c.id,
			name: c.name,
			status: c.status ?? null,
			effectiveStatus: c.effective_status ?? null,
			objective: c.objective ?? null,
			dailyBudgetCents: cents(c.daily_budget),
			metaCreatedAt: c.created_time ? new Date(c.created_time) : null
		})),
		...adsets.map((s) => ({
			...base,
			level: 'ADSET',
			externalId: s.id,
			campaignId: s.campaign_id ?? null,
			name: s.name,
			status: s.status ?? null,
			effectiveStatus: s.effective_status ?? null,
			dailyBudgetCents: cents(s.daily_budget),
			metaCreatedAt: s.created_time ? new Date(s.created_time) : null
		})),
		...ads.map((a) => ({
			...base,
			level: 'AD',
			externalId: a.id,
			campaignId: a.campaign_id ?? null,
			adsetId: a.adset_id ?? null,
			name: a.name,
			status: a.status ?? null,
			effectiveStatus: a.effective_status ?? null,
			thumbnailUrl: a.creative?.thumbnail_url ?? null,
			metaCreatedAt: a.created_time ? new Date(a.created_time) : null
		}))
	];

	await db.$transaction(
		[
			db.metaEntity.deleteMany({ where: { accountId: account.id } }),
			db.metaEntity.createMany({ data: rows })
		],
		TX_OPTIONS
	);
	return { campaigns: campaigns.length, adsets: adsets.length, ads: ads.length };
}
