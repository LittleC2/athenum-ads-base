// Avisos por e-mail só pro dono da conta (Resend). Desligado enquanto não houver RESEND_API_KEY.
// O resumo só sai quando a lista de pendências muda (evita repetir o mesmo aviso a cada hora).
import { createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { portfolioOf } from '../portfolio.js';
import { db } from './db.js';
import { loadOverview } from './overview.js';
import { getSetting, setSetting } from './settings.js';
import { getTokenHealth } from './meta/token.js';

export const emailConfigured = () => Boolean(env.RESEND_API_KEY);

const esc = (s) =>
	String(s).replace(
		/[&<>"]/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
	);

async function sendEmail({ to, subject, html }) {
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: env.NOTIFY_FROM || 'Athenum Ads <onboarding@resend.dev>',
			to,
			subject,
			html
		})
	});
	if (!res.ok) throw new Error(`Resend recusou o envio (${res.status}).`);
}

/** Pendências que merecem aviso: só as vermelhas, mais o aviso do token. */
export async function currentQueue() {
	const [clients, token] = await Promise.all([loadOverview(), getTokenHealth()]);
	const portfolio = portfolioOf(clients, { tokenWarning: token.warning ?? token.error ?? null });
	return portfolio.queue.filter((q) => q.level === 'RED');
}

function digestHtml(queue, baseUrl) {
	const rows = queue.map((q) => `<li><strong>${esc(q.who)}</strong>: ${esc(q.text)}</li>`).join('');
	return `<div style="font-family:system-ui,sans-serif;max-width:520px">
<h2 style="margin:0 0 8px">Precisa de você agora</h2>
<ul style="padding-left:18px;line-height:1.6">${rows}</ul>
<p><a href="${esc(baseUrl)}/admin">Abrir o painel</a></p></div>`;
}

/**
 * Envia o resumo aos admins se a lista de pendências mudou desde o último envio.
 * @returns {Promise<{ sent: boolean, reason?: string, items?: number }>}
 */
export async function sendDigestIfChanged({ force = false } = {}) {
	if (!emailConfigured()) return { sent: false, reason: 'RESEND_API_KEY não configurada.' };
	const queue = await currentQueue();
	const hash = createHash('sha1')
		.update(queue.map((q) => `${q.who}|${q.text}`).join('\n'))
		.digest('hex');
	const last = await getSetting('digestHash', '');
	if (!force && hash === last) return { sent: false, reason: 'Nada de novo desde o último aviso.' };
	if (!queue.length && !force) {
		await setSetting('digestHash', hash);
		return { sent: false, reason: 'Sem pendências críticas.' };
	}
	// Aviso só pro dono: NOTIFY_TO, ou o admin mais antigo se a variável não existir.
	const owner =
		env.NOTIFY_TO?.trim() ||
		(
			await db.user.findFirst({
				where: { role: 'ADMIN', active: true },
				orderBy: { createdAt: 'asc' },
				select: { email: true }
			})
		)?.email;
	if (!owner) return { sent: false, reason: 'Nenhum destinatário (defina NOTIFY_TO).' };
	await sendEmail({
		to: [owner],
		subject: queue.length
			? `Athenum Ads: ${queue.length} ${queue.length === 1 ? 'pendência' : 'pendências'} crítica(s)`
			: 'Athenum Ads: teste de aviso',
		html: digestHtml(
			queue.length ? queue : [{ who: 'Teste', text: 'Aviso de teste.' }],
			env.PUBLIC_URL || 'http://localhost:5190'
		)
	});
	await setSetting('digestHash', hash);
	return { sent: true, items: queue.length };
}
