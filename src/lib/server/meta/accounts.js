// Descoberta das contas de anúncios que o token enxerga (acesso de parceiro).
import { paginate } from './client.js';

/** @returns {Promise<{ externalId: string, name: string, business: string|null, pageId: string|null }[]>} */
export async function discoverAccounts() {
	const rows = await paginate('me/adaccounts', {
		fields: 'id,name,account_status,business{name}',
		limit: 100
	});
	return rows
		.map((a) => ({
			externalId: a.id,
			name: (a.name ?? '').trim(),
			business: a.business?.name ?? null,
			status: a.account_status
		}))
		.sort((x, y) => x.name.localeCompare(y.name));
}

/** Páginas que a conta pode usar em anúncios (pra preencher pageId/igUserId). */
export async function accountPromotePages(externalId) {
	const rows = await paginate(`${externalId}/promote_pages`, { fields: 'id,name', limit: 50 });
	return rows.map((p) => ({ id: p.id, name: p.name }));
}

export async function pageInstagram(pageId) {
	try {
		const rows = await paginate(`${pageId}/instagram_accounts`, {
			fields: 'id,username',
			limit: 5
		});
		return rows[0] ?? null;
	} catch {
		return null;
	}
}
