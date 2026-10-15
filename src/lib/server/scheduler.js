// Tarefas agendadas dentro do próprio processo Node (precisa de servidor
// persistente, não serverless). Sincroniza todas as contas de hora em hora (no Railway) ou pelo GitHub Actions (no Vercel).
import cron from 'node-cron';
import { env } from '$env/dynamic/private';
import { syncAll } from './sync.js';

export function startScheduler() {
	if (globalThis.__adsSchedulerStarted || env.DISABLE_SCHEDULER === '1') return;
	globalThis.__adsSchedulerStarted = true;

	let busy = false;
	cron.schedule('7 * * * *', async () => {
		if (busy) return;
		busy = true;
		try {
			await syncAll();
		} catch (err) {
			console.error('[scheduler] falha na sincronização:', err.message);
		} finally {
			busy = false;
		}
	});
}
