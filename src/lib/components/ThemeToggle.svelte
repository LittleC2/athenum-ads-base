<script>
	import { onMount } from 'svelte';
	import Moon from '@lucide/svelte/icons/moon';
	import Sun from '@lucide/svelte/icons/sun';

	let theme = $state('dark');

	onMount(() => {
		theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
	});

	function toggle() {
		theme = theme === 'light' ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
		try {
			localStorage.setItem('ads-theme', theme);
		} catch {
			// Sem armazenamento (janela privada): o tema vale só até recarregar.
		}
	}
</script>

<button
	type="button"
	class="toggle"
	onclick={toggle}
	aria-label={theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'}
>
	{#if theme === 'light'}<Moon size={18} strokeWidth={2} />{:else}<Sun
			size={18}
			strokeWidth={2}
		/>{/if}
	<span>{theme === 'light' ? 'Tema escuro' : 'Tema claro'}</span>
</button>

<style>
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.6rem;
		border-radius: var(--radius-button);
		color: var(--color-text-dim);
		font-size: 0.85rem;
		font-weight: 600;
		border: none;
		background: transparent;
		cursor: pointer;
		width: 100%;
		text-align: left;
		font-family: inherit;
		transition:
			background-color var(--transition-fast),
			color var(--transition-fast);
	}

	.toggle :global(svg) {
		flex-shrink: 0;
	}

	.toggle:hover {
		background: var(--color-bg-elevated);
		color: var(--color-text);
	}

	@media (max-width: 860px) {
		.toggle {
			min-height: 3rem;
			gap: 0.8rem;
			padding: 0 0.8rem;
			border-radius: 10px;
			font-size: 0.92rem;
			color: var(--color-text);
		}

		.toggle :global(svg) {
			width: 20px;
			height: 20px;
		}
	}
</style>
