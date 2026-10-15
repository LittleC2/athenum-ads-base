<script>
	/** Bolinha de ajuda que abre uma explicação curta do termo, sem sair da tela. */
	let { text } = $props();
	let open = $state(false);
</script>

<span class="hint-wrap">
	<button
		type="button"
		class="q"
		aria-label="O que é isso?"
		aria-expanded={open}
		onclick={() => (open = !open)}
		onblur={() => (open = false)}>?</button
	>
	{#if open}<span class="tip" role="tooltip">{text}</span>{/if}
</span>

<style>
	.hint-wrap {
		position: relative;
		display: inline-flex;
	}

	.q {
		position: relative;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-dim);
		font-size: 0.65rem;
		line-height: 1;
		padding: 0;
		cursor: pointer;
	}

	/* Área de toque maior que o desenho. */
	.q::after {
		content: '';
		position: absolute;
		inset: -10px;
	}

	.q:hover,
	.q:focus-visible {
		color: var(--color-accent);
		border-color: var(--color-accent);
	}

	.tip {
		position: absolute;
		z-index: 20;
		left: 50%;
		top: calc(100% + 6px);
		transform: translateX(-50%);
		width: 220px;
		padding: 0.6rem 0.75rem;
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		box-shadow: var(--shadow-md);
		font-size: 0.78rem;
		font-weight: 400;
		line-height: 1.45;
		text-transform: none;
		letter-spacing: 0;
		color: var(--color-text);
	}
</style>
