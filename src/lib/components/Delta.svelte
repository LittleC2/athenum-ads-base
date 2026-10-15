<script>
	import ArrowDownRight from '@lucide/svelte/icons/arrow-down-right';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Minus from '@lucide/svelte/icons/minus';
	/**
	 * Variação contra o período anterior, em palavras e seta.
	 * `lowerIsBetter`: custo que cai é bom. `null` = sem base pra comparar.
	 */
	let { value, suffix = 'vs período anterior', lowerIsBetter = false, empty = '' } = $props();

	// Variação de milhares de % vem de base minúscula e só confunde: vira "bem maior".
	const huge = $derived(value != null && Math.abs(value) >= 3);
	const flat = $derived(value != null && Math.abs(value) < 0.005);
	const good = $derived(value == null || flat ? null : lowerIsBetter ? value < 0 : value > 0);
</script>

{#if value == null}
	{#if empty}<span class="muted small">{empty}</span>{/if}
{:else if flat}
	<span class="delta muted"
		><Minus size={13} strokeWidth={2.5} /> igual <span class="tail">{suffix}</span></span
	>
{:else}
	<span class="delta" class:good class:bad={good === false}>
		{#if value > 0}<ArrowUpRight size={13} strokeWidth={2.5} />{:else}<ArrowDownRight
				size={13}
				strokeWidth={2.5}
			/>{/if}
		{huge ? 'bem maior' : `${Math.round(Math.abs(value) * 100)}%`}
		<span class="tail">{suffix}</span>
	</span>
{/if}

<style>
	.delta {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.78rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.delta.good {
		color: var(--color-success);
	}

	.delta.bad {
		color: var(--color-danger);
	}

	.tail {
		font-weight: 400;
		color: var(--color-text-dim);
	}

	.small {
		font-size: 0.78rem;
	}
</style>
