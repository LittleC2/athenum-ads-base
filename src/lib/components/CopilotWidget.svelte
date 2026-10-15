<script>
	import { onMount, tick } from 'svelte';
	import Bot from '@lucide/svelte/icons/bot';
	import X from '@lucide/svelte/icons/x';
	import Send from '@lucide/svelte/icons/send';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import RichText from './RichText.svelte';

	let open = $state(false);
	let configured = $state(true);
	let messages = $state([]);
	let input = $state('');
	let sending = $state(false);
	let box = $state();

	const SUGGESTIONS = [
		'Como estão todas as contas esta semana?',
		'Quais anúncios devo pausar hoje?',
		'Onde estou gastando mal?'
	];

	async function scrollDown() {
		await tick();
		if (box) box.scrollTop = box.scrollHeight;
	}

	onMount(async () => {
		try {
			const res = await fetch('/api/admin/copiloto');
			if (res.ok) {
				const json = await res.json();
				configured = json.configured;
				messages = json.messages;
			}
		} catch {
			// Sem histórico: o painel abre vazio.
		}
	});

	async function send(text) {
		const message = (text ?? input).trim();
		if (!message || sending) return;
		input = '';
		sending = true;
		messages.push({ role: 'user', content: message });
		messages.push({ role: 'assistant', content: '' });
		const last = messages.length - 1;
		await scrollDown();
		try {
			const res = await fetch('/api/admin/copiloto', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				messages[last].content = err.error ?? 'Não consegui responder agora.';
			} else {
				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				for (;;) {
					const { done, value } = await reader.read();
					if (done) break;
					messages[last].content += decoder.decode(value, { stream: true });
					await scrollDown();
				}
			}
		} catch {
			messages[last].content = 'A conexão caiu. Tente de novo.';
		}
		sending = false;
		await scrollDown();
	}

	async function clear() {
		await fetch('/api/admin/copiloto', { method: 'DELETE' });
		messages = [];
	}
</script>

<div class="no-print">
	{#if !open}
		<button class="fab" type="button" onclick={() => (open = true)} aria-label="Abrir o copiloto">
			<Bot size={22} />
		</button>
	{:else}
		<aside class="panel card" aria-label="Copiloto Claude">
			<header>
				<strong>Copiloto</strong>
				<div class="row">
					<button
						class="btn-icon"
						type="button"
						onclick={clear}
						aria-label="Limpar conversa"
						title="Limpar conversa"><Trash2 size={14} /></button
					>
					<button class="btn-icon" type="button" onclick={() => (open = false)} aria-label="Fechar"
						><X size={14} /></button
					>
				</div>
			</header>

			<div class="msgs" bind:this={box}>
				{#if !configured}
					<p class="muted">O copiloto precisa da ANTHROPIC_API_KEY no servidor. Veja Ajustes.</p>
				{:else if messages.length === 0}
					<p class="muted">
						Pergunte sobre as contas ou peça uma análise. Eu leio os dados e proponho mudanças; você
						aprova na tela de Ações.
					</p>
					<div class="chips sugg">
						{#each SUGGESTIONS as s (s)}<button class="chip" type="button" onclick={() => send(s)}
								>{s}</button
							>{/each}
					</div>
				{/if}
				{#each messages as m, i (i)}
					<div class="msg {m.role}">
						{#if m.role === 'assistant'}
							{#if m.content}<RichText text={m.content} />{:else}<span class="muted"
									>Pensando...</span
								>{/if}
						{:else}
							{m.content}
						{/if}
					</div>
				{/each}
			</div>

			<form
				class="composer"
				onsubmit={(e) => {
					e.preventDefault();
					send();
				}}
			>
				<input
					bind:value={input}
					placeholder="Pergunte ao copiloto"
					disabled={sending || !configured}
					aria-label="Mensagem"
				/>
				<button
					class="btn-icon send"
					type="submit"
					disabled={sending || !input.trim() || !configured}
					aria-label="Enviar"><Send size={15} /></button
				>
			</form>
		</aside>
	{/if}
</div>

<style>
	.fab {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		z-index: 25;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: none;
		background: var(--color-accent);
		color: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: var(--shadow-accent);
		z-index: 30;
	}

	.panel {
		position: fixed;
		right: 1.25rem;
		bottom: 1.25rem;
		width: min(420px, calc(100vw - 1.5rem));
		height: min(640px, calc(100dvh - 2.5rem));
		display: flex;
		flex-direction: column;
		z-index: 40;
		box-shadow: var(--shadow-md);
		overflow: hidden;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.7rem 0.9rem;
		border-bottom: 1px solid var(--color-border);
	}

	.msgs {
		flex: 1;
		overflow-y: auto;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.msg {
		padding: 0.6rem 0.8rem;
		border-radius: var(--radius-card);
		font-size: 0.88rem;
		line-height: 1.5;
		max-width: 92%;
		white-space: pre-wrap;
	}

	.msg.user {
		align-self: flex-end;
		background: var(--color-accent-dim);
		border: 1px solid rgba(205, 167, 107, 0.35);
	}

	.msg.assistant {
		align-self: flex-start;
		background: var(--color-bg-elevated);
		white-space: normal;
	}

	.sugg {
		flex-direction: column;
		align-items: flex-start;
	}

	.composer {
		display: flex;
		gap: 0.5rem;
		padding: 0.7rem;
		border-top: 1px solid var(--color-border);
	}

	.composer input {
		flex: 1;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-button);
		padding: 0.6rem 0.75rem;
		color: var(--color-text);
	}

	.send {
		width: 2.4rem;
		height: auto;
		background: var(--color-accent);
		color: #000;
		border: none;
	}

	@media (max-width: 860px) {
		.fab {
			bottom: 5.5rem;
		}

		.panel {
			bottom: 5rem;
			height: min(600px, calc(100dvh - 6.5rem));
		}
	}
</style>
