// Modo "só dashboard" (DASHBOARD_ONLY=1): em produção o painel mostra apenas dashboards,
// alertas e relatórios. Campanhas, biblioteca, fila de ações e copiloto ficam no terminal.
export const DASHBOARD_ONLY_BLOCKED = [
	'/admin/campanhas',
	'/admin/biblioteca',
	'/admin/acoes',
	'/api/admin/copiloto',
	'/api/admin/asset',
	'/api/admin/cidades'
];

export function isBlockedInDashboardOnly(pathname) {
	return DASHBOARD_ONLY_BLOCKED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const HIDDEN_LINKS_IN_DASHBOARD_ONLY = [
	'/admin/campanhas',
	'/admin/acoes',
	'/admin/biblioteca'
];
