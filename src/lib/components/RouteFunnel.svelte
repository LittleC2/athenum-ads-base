<script>
	import { int } from '$lib/format.js';

	/** O caminho do anúncio até o cliente: o volume de cada etapa vira o tamanho do ponto. */
	let { stages } = $props();

	const max = $derived(Math.max(1, ...stages.map((s) => s.count)));
	// Escala de raiz: etapas pequenas continuam visíveis ao lado das grandes.
	const size = (count) => 10 + Math.round(Math.sqrt(count / max) * 18);
	const conv = (i) =>
		i > 0 && stages[i - 1].count > 0 ? (stages[i].count / stages[i - 1].count) * 100 : null;
	const convText = (v) => (v < 1 ? v.toFixed(1) : String(Math.round(v)));
</script>

<ol class="route" style="--n:{stages.length}">
	{#each stages as s, i (s.key)}
		<li>
			{#if i < stages.length - 1}<span class="line" class:solid={s.count > 0}></span>{/if}
			<span class="dotbox"
				><span class="dot" style="width:{size(s.count)}px; height:{size(s.count)}px"></span></span
			>
			<strong class="count">{int(s.count)}</strong>
			<span class="name">{s.name}</span>
			{#if conv(i) != null}
				<span class="conv">{convText(conv(i))}% da etapa anterior</span>
			{/if}
		</li>
	{/each}
</ol>

<style>
	.route {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
	}

	li {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 0 0.25rem;
		min-width: 0;
	}

	.dotbox {
		height: 28px;
		display: flex;
		align-items: center;
	}

	.dot {
		position: relative;
		z-index: 1;
		border-radius: 50%;
		background: var(--color-accent);
		box-shadow: 0 0 0 4px var(--color-bg-alt);
		transition:
			width 500ms var(--ease-out),
			height 500ms var(--ease-out);
	}

	.line {
		position: absolute;
		top: 14px;
		left: 50%;
		width: 100%;
		height: 2px;
		background-image: radial-gradient(circle, var(--color-border) 1px, transparent 1.5px);
		background-size: 8px 2px;
	}

	.line.solid {
		background: color-mix(in srgb, var(--color-accent) 40%, transparent);
	}

	.count {
		margin-top: 0.5rem;
		font-size: 1.35rem;
		letter-spacing: -0.02em;
	}

	.name {
		font-size: 0.78rem;
		color: var(--color-text-dim);
		line-height: 1.3;
		margin-top: 0.15rem;
	}

	.conv {
		margin-top: 0.3rem;
		font-size: 0.68rem;
		color: var(--color-accent);
	}

	@media (max-width: 560px) {
		.route {
			grid-template-columns: 1fr;
			gap: 0.9rem;
		}

		li {
			flex-direction: row;
			flex-wrap: wrap;
			justify-content: flex-start;
			text-align: left;
			gap: 0.75rem;
		}

		.line {
			display: none;
		}

		.count {
			margin: 0;
			min-width: 4ch;
		}

		.name {
			margin: 0;
			flex: 1;
		}

		.conv {
			width: 100%;
			padding-left: calc(28px + 0.75rem);
			margin: -0.5rem 0 0;
		}
	}
</style>
