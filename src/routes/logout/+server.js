import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, clearSessionCookie, deleteSession } from '$lib/server/auth.js';

export const POST = async ({ cookies }) => {
	await deleteSession(cookies.get(SESSION_COOKIE));
	clearSessionCookie(cookies);
	throw redirect(303, '/login');
};
