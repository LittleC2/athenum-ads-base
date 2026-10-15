// Orquestra a sincronização de uma conta: entidades, números diários e alertas.
import { db } from './db.js';
import { redactSecrets } from '../redact.js';
import { addDays, todayInSP } from '../dates.js';
import { syncEntities } from './meta/entities.js';
import { syncInsights } from './meta/insights.js';
import { refreshAlerts } from './alerts.js';
import { withAccountToken } from './meta/client.js';

const BACKFILL_DAYS = 210;
const REFRESH_DAYS = 4; // hoje + 3 dias, a Meta corrige a atribuição depois

const running = new Set();

/**
 * @param {string} accountId id interno da AdAccount
 * @param {{ fullBackfill?: boolean }} [opts]
 */
export async function syncAccount(accountId, { fullBackfill = false } = {}) {
	if (running.has(accountId)) return { skipped: true };
	running.add(accountId);
	try {
		const account = await db.adAccount.findUnique({ where: { id: accountId } });
		if (!account) throw new Error('Conta não encontrada.');
		const today = todayInSP();
		const days = fullBackfill || !account.backfilledAt ? BACKFILL_DAYS : REFRESH_DAYS;
		const since = addDays(today, -(days - 1));

		const { entities, rows, alerts } = await withAccountToken(account, async () => ({
			entities: await syncEntities(account),
			rows: await syncInsights(account, since, today),
			alerts: await refreshAlerts(account)
		}));

		await db.adAccount.update({
			where: { id: account.id },
			data: {
				syncedAt: new Date(),
				lastSyncError: null,
				backfilledAt: account.backfilledAt ?? new Date()
			}
		});
		return { entities, rows, alerts, days };
	} catch (err) {
		await db.adAccount
			.update({
				where: { id: accountId },
				data: { lastSyncError: redactSecrets(err.message).slice(0, 500) }
			})
			.catch(() => {});
		throw err;
	} finally {
		running.delete(accountId);
	}
}

export async function syncAll({ fullBackfill = false } = {}) {
	const accounts = await db.adAccount.findMany({
		where: { active: true },
		select: { id: true, externalId: true }
	});
	const out = [];
	for (const a of accounts) {
		try {
			out.push({ account: a.externalId, ...(await syncAccount(a.id, { fullBackfill })) });
		} catch (err) {
			out.push({ account: a.externalId, error: err.message });
		}
		await new Promise((r) => setTimeout(r, 1500));
	}
	return out;
}
