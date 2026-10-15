<script>
	import Delta from '$lib/components/Delta.svelte';
	import RichText from '$lib/components/RichText.svelte';
	import RouteFunnel from '$lib/components/RouteFunnel.svelte';
	import TrendChart from '$lib/components/TrendChart.svelte';
	import { brl, int } from '$lib/format.js';
	import { fullBR } from '$lib/dates.js';
	import { RESULT_LABELS } from '$lib/metrics.js';

	let { data } = $props();
	const r = $derived(data.report);
	const d = $derived(data.dashboard);
	const labels = $derived(RESULT_LABELS[r.resultType ?? 'LEAD_FORM']);
	const frac = (v) => (v == null ? null : v / 100);
	const topAds = $derived(
		d
			? d.ads
					.filter((a) => a.results > 0)
					.sort((a, b) => b.results - a.results)
					.slice(0, 4)
			: []
	);
</script>

<svelte:head>
	<title>{r.title} · Athenum Ads</title>
</svelte:head>

<div class="page doc">
	<div class="row no-print bar">
		<a class="btn btn-secondary" href="/painel/relatorios">Voltar</a>
		<button class="btn" type="button" onclick={() => window.print()}>Salvar em PDF</button>
	</div>

	<header class="cover">
		<span class="brand"><b>A</b> Athenum</span>
		<h1>{r.title}</h1>
		<p class="sub">{data.clientName} · {fullBR(r.periodStart)} a {fullBR(r.periodEnd)}</p>
	</header>

	{#if d}
		<section class="grid grid-4 tiles">
			<div class="tile">
				<span class="lab">Investido</span>
				<strong>{brl(d.cur.spendCents)}</strong>
				<Delta value={frac(d.changes.spend)} suffix="vs período anterior" />
			</div>
			<div class="tile">
				<span class="lab">{labels.title}</span>
				<strong>{int(d.cur.results)}</strong>
				<Delta value={frac(d.changes.results)} suffix="vs período anterior" />
			</div>
			<div class="tile">
				<span class="lab">{labels.cost}</span>
				<strong>{d.cur.costCents != null ? brl(d.cur.costCents) : '-'}</strong>
				<Delta value={frac(d.changes.cost)} suffix="vs período anterior" lowerIsBetter />
			</div>
			<div class="tile">
				<span class="lab">Pessoas alcançadas</span>
				<strong>{d.cur.reach != null ? int(d.cur.reach) : '-'}</strong>
				<span class="muted small">viram o anúncio</span>
			</div>
		</section>
	{:else if r.kpis}
		<section class="grid grid-4 tiles">
			<div class="tile">
				<span class="lab">Investido</span><strong>{brl(r.kpis.spendCents)}</strong>
			</div>
			<div class="tile">
				<span class="lab">{labels.title}</span><strong>{int(r.kpis.results)}</strong>
			</div>
			<div class="tile">
				<span class="lab">{labels.cost}</span><strong
					>{r.kpis.costCents != null ? brl(r.kpis.costCents) : '-'}</strong
				>
			</div>
			<div class="tile">
				<span class="lab">Pessoas alcançadas</span><strong
					>{r.kpis.reach != null ? int(r.kpis.reach) : '-'}</strong
				>
			</div>
		</section>
	{/if}

	<section class="card card-pad">
		<h2 class="section-title">Resumo do período</h2>
		<RichText text={r.clientSummary} />
	</section>

	{#if d}
		<section class="card card-pad avoid-break">
			<h2 class="section-title">Como foi dia a dia</h2>
			<TrendChart series={d.series} resultLabel={labels.plural} />
		</section>

		<section class="card card-pad avoid-break">
			<h2 class="section-title">Do anúncio até virar cliente</h2>
			<RouteFunnel stages={d.story.funnel} />
		</section>

		{#if topAds.length}
			<section class="card card-pad avoid-break">
				<h2 class="section-title">Anúncios que mais trouxeram resultado</h2>
				<div class="gallery">
					{#each topAds as a (a.id)}
						<article class="ad">
							{#if a.thumbnailUrl}<img src={a.thumbnailUrl} alt="" />{/if}
							<strong>{a.name}</strong>
							<span class="muted small"
								>{int(a.results)} {a.results === 1 ? labels.singular : labels.plural}</span
							>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	{/if}

	<footer class="foot muted small">Relatório gerado pela Athenum · dados da Meta Ads</footer>
</div>

<style>
	.doc {
		max-width: 920px;
	}

	.bar {
		justify-content: flex-end;
	}

	.cover {
		padding: 0.5rem 0 0.25rem;
		border-bottom: 2px solid var(--color-accent);
		padding-bottom: 1rem;
	}

	.cover h1 {
		margin: 0.6rem 0 0.2rem;
		font-size: 1.9rem;
		letter-spacing: -0.02em;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 800;
		text-transform: uppercase;
		font-size: 0.8rem;
		letter-spacing: 0.04em;
	}

	.brand b {
		width: 24px;
		height: 24px;
		border-radius: 6px;
		background: var(--color-accent);
		color: #000;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.sub {
		margin: 0;
		color: var(--color-text-dim);
	}

	.tile {
		padding: 0.9rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg-alt);
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.lab {
		font-size: 0.75rem;
		color: var(--color-text-dim);
	}

	.tile strong {
		font-size: 1.45rem;
		letter-spacing: -0.02em;
	}

	.small {
		font-size: 0.78rem;
	}

	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.9rem;
		margin-top: 0.7rem;
	}

	.ad {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		font-size: 0.85rem;
	}

	.ad img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 8px;
	}

	.foot {
		text-align: center;
		padding: 0.5rem 0 0;
	}

	@media print {
		.avoid-break {
			break-inside: avoid;
		}
	}
</style>
