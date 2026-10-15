<script>
	/**
	 * Mini-gráfico de tendência: só a forma da série, sem eixos. Sem variação não desenha nada
	 * (uma linha reta fingiria informar). `peak` marca o maior ponto com o valor numa pílula.
	 */
	let { values, color = 'var(--color-accent)', height = 36, peak = null } = $props();

	const W = 100;
	const H = 28;
	const sw = 1.5;

	const varies = $derived(values.length >= 2 && new Set(values).size > 1);
	const max = $derived(Math.max(...values));
	const min = $derived(Math.min(0, ...values));
	const step = $derived(W / Math.max(values.length - 1, 1));
	const y = (v) => H - ((v - min) / (max - min || 1)) * (H - sw) - sw / 2;
	const line = $derived(
		values
			.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${y(v).toFixed(2)}`)
			.join(' ')
	);
	const area = $derived(`${line} L${W},${H} L0,${H} Z`);
	const peakIndex = $derived(values.lastIndexOf(max));
	const left = $derived((peakIndex / Math.max(values.length - 1, 1)) * 100);
	const top = $derived((y(max) / H) * 100);
</script>

{#if varies}
	<div class="spark" style="height:{height}px; color:{color}">
		<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" aria-hidden="true">
			<path d={area} fill="currentColor" opacity="0.14" />
			<path
				d={line}
				fill="none"
				stroke="currentColor"
				stroke-width={sw}
				stroke-linecap="round"
				stroke-linejoin="round"
				vector-effect="non-scaling-stroke"
			/>
		</svg>
		{#if peak}
			<span class="dot" style="left:{left}%; top:{top}%"></span>
			<span
				class="pill"
				class:r={left > 80}
				class:l={left < 20}
				style="left:{left}%; top:{top}%"
				title={peak.label}>{peak.format(max)}</span
			>
		{/if}
	</div>
{/if}

<style>
	.spark {
		position: relative;
		width: 100%;
	}

	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.dot {
		position: absolute;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
		box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 25%, transparent);
		transform: translate(-50%, -50%);
	}

	.pill {
		position: absolute;
		transform: translate(-50%, calc(-100% - 8px));
		background: var(--color-text);
		color: var(--color-bg);
		font-size: 0.68rem;
		font-weight: 700;
		line-height: 1;
		padding: 0.22rem 0.4rem;
		border-radius: 999px;
		white-space: nowrap;
	}

	.pill.r {
		transform: translate(-85%, calc(-100% - 8px));
	}

	.pill.l {
		transform: translate(-15%, calc(-100% - 8px));
	}
</style>
