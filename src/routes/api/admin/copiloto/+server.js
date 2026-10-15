import { json } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { clearCopilotHistory, copilotHistory, copilotReply } from '$lib/server/ai/copilot.js';
import { hasAnthropic } from '$lib/server/ai/anthropic.js';

export const GET = async ({ locals }) => {
	const admin = requireAdmin(locals);
	return json({ configured: hasAnthropic(), messages: await copilotHistory(admin.id) });
};

export const POST = async ({ request, locals }) => {
	const admin = requireAdmin(locals);
	const { message } = await request.json().catch(() => ({}));
	const text = String(message ?? '')
		.trim()
		.slice(0, 4000);
	if (!text) return json({ error: 'Mensagem vazia.' }, { status: 400 });
	if (!hasAnthropic()) {
		return json(
			{ error: 'O copiloto precisa da ANTHROPIC_API_KEY configurada no servidor.' },
			{ status: 503 }
		);
	}
	const stream = await copilotReply({ userId: admin.id, message: text });
	return new Response(stream, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
	});
};

export const DELETE = async ({ locals }) => {
	const admin = requireAdmin(locals);
	await clearCopilotHistory(admin.id);
	return json({ ok: true });
};
