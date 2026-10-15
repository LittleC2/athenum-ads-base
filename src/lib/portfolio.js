// Visão do portfólio pro gestor: totais da semana e a fila "precisa de você agora".
// Módulo puro: recebe o resultado de loadOverview() e devolve o que a tela desenha.

/**
 * @param {Array} clients saída de loadOverview()
 * @param {{ tokenWarning?: string|null, pendingActions?: number, dashboardOnly?: boolean }} [ctx]
 */
export function portfolioOf(
	clients,
	{ tokenWarning = null, pendingActions = 0, dashboardOnly = false } = {}
) {
	let spendCents = 0;
	let accountsWithSpend = 0;
	let healthy = 0;
	const queue = [];

	for (const c of clients) {
		for (const a of c.accounts) {
			spendCents += a.cur.spendCents;
			if (a.cur.spendCents > 0) accountsWithSpend++;
			const where = `${c.name}`;
			const href = `/admin/clientes/${c.id}`;
			let problem = false;

			if (a.lastSyncError) {
				queue.push({
					level: 'RED',
					who: where,
					text: 'Falha ao atualizar os dados da Meta.',
					href
				});
				problem = true;
			} else if (!a.syncedAt) {
				queue.push({ level: 'YELLOW', who: where, text: 'Conta ainda não sincronizada.', href });
				problem = true;
			}
			if (a.alerts.RED) {
				queue.push({
					level: 'RED',
					who: where,
					text: `${a.alerts.RED} ${a.alerts.RED === 1 ? 'alerta de atenção aberto' : 'alertas de atenção abertos'}.`,
					href: '/admin/alertas'
				});
				problem = true;
			}
			if (a.targetCostCents && a.cur.costCents > a.targetCostCents * 1.3) {
				queue.push({
					level: 'RED',
					who: where,
					text: 'Custo por resultado mais de 30% acima da meta.',
					href
				});
				problem = true;
			} else if (a.costChange != null && a.costChange > 20) {
				queue.push({
					level: 'YELLOW',
					who: where,
					text: `Custo por resultado subiu ${Math.round(a.costChange)}% na semana.`,
					href
				});
				problem = true;
			}
			if (a.prevResults > 0 && a.cur.spendCents > 0 && a.cur.results === 0) {
				queue.push({ level: 'RED', who: where, text: 'Gastando sem trazer resultado.', href });
				problem = true;
			}
			if (!problem && a.cur.spendCents > 0) healthy++;
		}
	}

	if (tokenWarning)
		queue.unshift({ level: 'RED', who: 'Meta', text: tokenWarning, href: '/admin/ajustes' });
	if (!dashboardOnly && pendingActions > 0) {
		queue.push({
			level: 'YELLOW',
			who: 'Fila',
			text: `${pendingActions} ${pendingActions === 1 ? 'ação aguardando' : 'ações aguardando'} sua aprovação.`,
			href: '/admin/acoes'
		});
	}
	const rank = { RED: 0, YELLOW: 1 };
	queue.sort((x, y) => (rank[x.level] ?? 2) - (rank[y.level] ?? 2));

	return { spendCents, accountsWithSpend, healthy, queue };
}
