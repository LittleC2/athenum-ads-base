import { fail, redirect } from '@sveltejs/kit';
import { attemptLogin, createSession, setSessionCookie } from '$lib/server/auth.js';

export const load = async ({ locals }) => {
	if (locals.user) throw redirect(303, '/');
	return {};
};

export const actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');
		if (!email || !password) return fail(400, { error: 'Preencha e-mail e senha.' });

		const result = await attemptLogin(email, password);
		if ('error' in result) return fail(400, { error: result.error });

		const { token, expiresAt } = await createSession(result.user);
		setSessionCookie(cookies, token, expiresAt);

		const next = url.searchParams.get('next');
		const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
		throw redirect(303, safeNext);
	}
};
