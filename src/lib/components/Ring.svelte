<script>
	/** Anel de progresso (0 a 1). `mark` desenha onde deveria estar hoje. */
	let {
		value,
		size = 84,
		stroke = 8,
		mark = null,
		color = 'var(--color-accent)',
		children
	} = $props();

	const r = $derived((size - stroke) / 2);
	const c = $derived(2 * Math.PI * r);
	const clamped = $derived(Math.max(0, Math.min(1, value)));
	const cx = $derived(size / 2);
</script>

<span class="ring" style="width:{size}px; height:{size}px">
	<svg width={size} height={size} aria-hidden="true">
		<g transform="rotate(-90 {cx} {cx})">
			<circle {cx} cy={cx} {r} fill="none" stroke-width={stroke} class="track" />
			<circle
				{cx}
				cy={cx}
				{r}
				fill="none"
				stroke-width={stroke}
				stroke-linecap="round"
				stroke-dasharray={c}
				stroke-dashoffset={c * (1 - clamped)}
				style="stroke:{color}"
				class="bar"
			/>
		</g>
		{#if mark != null && mark > 0 && mark < 1}
			<circle
				cx={cx + r * Math.cos(2 * Math.PI * mark - Math.PI / 2)}
				cy={cx + r * Math.sin(2 * Math.PI * mark - Math.PI / 2)}
				r={stroke / 3}
				fill="var(--color-text)"
			/>
		{/if}
	</svg>
	{#if children}<span class="center">{@render children()}</span>{/if}
</span>

<style>
	.ring {
		position: relative;
		display: inline-flex;
		flex-shrink: 0;
	}

	.track {
		stroke: var(--color-bg-elevated);
	}

	.bar {
		transition: stroke-dashoffset 700ms var(--ease-out);
	}

	.center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.95rem;
	}
</style>
