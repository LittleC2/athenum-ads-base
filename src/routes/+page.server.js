import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	throw redirect(303, locals.user?.role === 'ADMIN' ? '/admin' : '/painel');
};
