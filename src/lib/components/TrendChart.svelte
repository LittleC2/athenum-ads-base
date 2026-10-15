<script>
	import { brl } from '$lib/format.js';
	import { shortBR } from '$lib/dates.js';

	/** @type {{ series: { date: string, spendCents: number, results: number }[], resultLabel: string }} */
	let { series, resultLabel } = $props();

	const W = 640;
	const H = 180;
	const PAD = { l: 8, r: 8, t: 12, b: 22 };

	const maxResults = $derived(Math.max(1, ...series.map((s) => s.results)));
	const maxSpend = $derived(Math.max(1, ...series.map((s) => s.spendCents)));
	const slot = $derived((W - PAD.l - PAD.r) / Math.max(series.length, 1));

	const x = (i) => PAD.l + slot * i + slot / 2;
	const yR = (v) => H - PAD.b - (v / maxResults) * (H - PAD.t - PAD.b);
	const yS = (v) => H - PAD.b - (v / maxSpend) * (H - PAD.t - PAD.b);

	const spendPath = $derived(
		series
			.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yS(s.spendCents).toFixed(1)}`)
			.join(' ')
	);
	const labelEvery = $derived(Math.ceil(series.length / 8));
</script>

<figure class="chart">
	<svg
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label="Evolução diária de {resultLabel} e investimento"
	>
		{#each series as s, i (s.date)}
			<rect
				x={x(i) - Math.min(slot * 0.32, 10)}
				y={yR(s.results)}
				width={Math.min(slot * 0.64, 20)}
				height={H - PAD.b - yR(s.results)}
				rx="2"
				fill="var(--color-accent)"
				opacity="0.85"
			>
				<title>{shortBR(s.date)}: {s.results} {resultLabel}, {brl(s.spendCents)}</title>
			</rect>
			{#if i % labelEvery === 0}
				<text x={x(i)} y={H - 6} text-anchor="middle" class="tick">{shortBR(s.date)}</text>
			{/if}
		{/each}
		<path d={spendPath} fill="none" stroke="var(--color-text)" stroke-width="1.5" opacity="0.7" />
	</svg>
	<figcaption class="legend">
		<span><i class="dot gold"></i> {resultLabel} por dia</span>
		<span><i class="dot line"></i> Investimento por dia</span>
	</figcaption>
</figure>

<style>
	.chart {
		margin: 0;
	}

	svg {
		width: 100%;
		height: auto;
		display: block;
	}

	.tick {
		font-size: 10px;
		fill: var(--color-text-dim);
	}

	.legend {
		display: flex;
		gap: 1.25rem;
		font-size: 0.75rem;
		color: var(--color-text-dim);
		margin-top: 0.4rem;
		flex-wrap: wrap;
	}

	.dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 2px;
		margin-right: 0.3rem;
	}

	.dot.gold {
		background: var(--color-accent);
	}

	.dot.line {
		height: 2px;
		background: var(--color-text);
		vertical-align: middle;
	}
</style>
