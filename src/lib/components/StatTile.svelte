<script>
	import { signedPct } from '$lib/format.js';

	/**
	 * Métrica + valor grande + variação opcional vs período anterior.
	 * `lowerIsBetter` inverte a cor da variação (custo que cai é bom).
	 */
	let { label, value, delta = null, lowerIsBetter = false, neutral = false, hint = '' } = $props();

	const good = $derived(delta == null || neutral ? null : lowerIsBetter ? delta < 0 : delta > 0);
</script>

<div class="card stat-tile">
	<span class="stat-label">{label}</span>
	<strong class="stat-value">{value}</strong>
	{#if delta != null && Math.abs(delta) >= 0.05}
		<span class="stat-delta" class:up={good} class:down={good === false}>
			{signedPct(delta)} <span class="muted">vs período anterior</span>
		</span>
	{:else if hint}
		<span class="stat-delta muted">{hint}</span>
	{/if}
</div>
