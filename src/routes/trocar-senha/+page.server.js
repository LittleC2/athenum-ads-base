import { fail, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteUserSessions, hashPassword } from '$lib/server/auth.js';
import { db } from '$lib/server/db.js';

export const actions = {
	default: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) throw redirect(303, '/login');
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');
		if (password.length < 8) return fail(400, { error: 'Use pelo menos 8 caracteres.' });
		if (password !== confirm) return fail(400, { error: 'As senhas não são iguais.' });

		await db.user.update({
			where: { id: user.id },
			data: { passwordHash: await hashPassword(password), mustChangePassword: false }
		});
		await deleteUserSessions(user.id, cookies.get(SESSION_COOKIE));
		throw redirect(303, '/');
	}
};
