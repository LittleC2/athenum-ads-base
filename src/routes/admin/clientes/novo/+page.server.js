import { fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { audit } from '$lib/server/audit.js';
import { slugify } from '$lib/slug.js';

export const actions = {
	default: async ({ request, locals }) => {
		const admin = requireAdmin(locals);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const segment = String(form.get('segment') ?? '').trim() || null;
		if (name.length < 2) return fail(400, { error: 'Informe o nome do cliente.', name, segment });

		let slug = slugify(name) || 'cliente';
		if (await db.client.findUnique({ where: { slug } }))
			slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

		const client = await db.client.create({ data: { name, segment, slug } });
		await db.clientBrief.create({ data: { clientId: client.id } });
		await audit({
			userId: admin.id,
			clientId: client.id,
			action: 'client.create',
			target: client.name
		});
		throw redirect(303, `/admin/clientes/${client.id}?aba=contas`);
	}
};
