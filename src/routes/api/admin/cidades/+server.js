import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { searchCities } from '$lib/server/meta/builder.js';
import { withAccountToken } from '$lib/server/meta/client.js';
import { db } from '$lib/server/db.js';

export const GET = async ({ url, locals }) => {
	requireAdmin(locals);
	const q = (url.searchParams.get('q') ?? '').trim();
	if (q.length < 2) return json([]);
	try {
		const accountId = url.searchParams.get('conta');
		const account = accountId ? await db.adAccount.findUnique({ where: { id: accountId } }) : null;
		return json(await withAccountToken(account, () => searchCities(q)));
	} catch (err) {
		return json({ error: err.message }, { status: 502 });
	}
};
