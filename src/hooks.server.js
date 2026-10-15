import { error, redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, getSessionUser } from '$lib/server/auth.js';
import { env } from '$env/dynamic/private';
import { isBlockedInDashboardOnly } from '$lib/dashboardOnly.js';
import { startScheduler } from '$lib/server/scheduler.js';

const PUBLIC_PATHS = ['/login'];

startScheduler();

const SECURITY_HEADERS = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'same-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const token = event.cookies.get(SESSION_COOKIE);
	event.locals.user = token ? await getSessionUser(token) : null;
	const { pathname } = event.url;
	const user = event.locals.user;

	// Endpoints JSON com cookie: o formulário do SvelteKit já checa a origem, estes não.
	const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
	const origin = event.request.headers.get('origin');
	if (isWrite && pathname.startsWith('/api/') && origin && origin !== event.url.origin) {
		throw error(403, 'Origem não permitida.');
	}

	if (env.DASHBOARD_ONLY === '1' && isBlockedInDashboardOnly(pathname)) {
		throw error(404, 'Não encontrado.');
	}

	const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
	if (!isPublic && !user) {
		throw redirect(303, `/login?next=${encodeURIComponent(pathname)}`);
	}

	if (user) {
		// Cada papel só enxerga a sua área.
		const adminArea = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
		const clientArea = pathname.startsWith('/painel');
		if (user.role === 'CLIENT' && adminArea) throw redirect(303, '/painel');
		if (user.role === 'ADMIN' && clientArea) throw redirect(303, '/admin');

		if (user.mustChangePassword && pathname !== '/trocar-senha' && pathname !== '/logout') {
			throw redirect(303, '/trocar-senha');
		}
	}

	const response = await resolve(event);
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
	if (process.env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
	}
	return response;
}
