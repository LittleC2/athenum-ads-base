<script>
	import { ago, brl, decimal, int, pct, statusLabel } from '$lib/format.js';
	import { daysInMonth, fullBR, PERIOD_LABELS } from '$lib/dates.js';
	import { RESULT_LABELS } from '$lib/metrics.js';
	import { glossaryFor } from '$lib/story.js';
	import AlertList from './AlertList.svelte';
	import Delta from './Delta.svelte';
	import Hint from './Hint.svelte';
	import Ring from './Ring.svelte';
	import RouteFunnel from './RouteFunnel.svelte';
	import Sparkline from './Sparkline.svelte';
	import TrendChart from './TrendChart.svelte';

	/**
	 * Dashboard de uma conta. `mode` 'client' é a versão em palavras simples ("ao vivo");
	 * 'admin' soma CTR, CPM, frequência e a tabela completa, partindo da mesma fonte.
	 */
	let { data, account, alerts, preset, mode = 'client', basePath = '' } = $props();

	const labels = $derived(RESULT_LABELS[account.resultType]);
	const isAdmin = $derived(mode === 'admin');
	const story = $derived(data.story);
	const glossary = $derived(glossaryFor(account.resultType));

	const shownAds = $derived(
		isAdmin
			? data.ads.filter((a) => a.spendCents > 0)
			: data.ads
					.filter((a) => a.results > 0)
					.sort((a, b) => (a.costCents ?? Infinity) - (b.costCents ?? Infinity))
					.slice(0, 6)
	);
	const shownCampaigns = $derived(data.campaigns.filter((c) => c.spendCents > 0));
	const days = $derived(story.sparks.results.length);
	const vs = 'vs período anterior';
	// pctChange vem em percentual (20 = +20%); o componente Delta usa fração.
	const frac = (v) => (v == null ? null : v / 100);
</script>

<div class="row no-print">
	<div class="chips">
		{#each Object.entries(PERIOD_LABELS) as [key, text] (key)}
			<a class="chip" class:active={preset === key} href="{basePath}?periodo={key}">{text}</a>
		{/each}
	</div>
	<span class="muted small">{fullBR(data.period.since)} a {fullBR(data.period.until)}</span>
</div>

<!-- Herói: o estado da conta em uma frase e o número que mais importa -->
<section class="hero tone-{story.health.level}">
	<div class="hero-main">
		<div class="hero-top">
			<span class="live"><i></i> Ao vivo · atualizado {ago(story.syncedAt)}</span>
			<span class="status">{story.health.label}</span>
		</div>
		<h2>{story.health.headline}</h2>
		<p class="hero-detail">{story.health.detail}</p>
	</div>
	<div class="hero-num">
		<span class="hero-label">{labels.title} <Hint text={labels.clientHint} /></span>
		<strong>{int(data.cur.results)}</strong>
		<Delta value={frac(data.changes.results)} suffix={vs} />
		<div class="hero-spark">
			<Sparkline
				values={story.sparks.results}
				height={44}
				peak={{ label: 'Melhor dia', format: (v) => int(v) }}
			/>
		</div>
		<span class="hero-foot muted small">{days} {days === 1 ? 'dia' : 'dias'} no gráfico</span>
	</div>
</section>

{#if alerts.length}
	<section>
		<h2 class="section-title">{isAdmin ? 'Alertas' : 'Avisos'}</h2>
		<AlertList {alerts} />
	</section>
{/if}

<section class="grid grid-4">
	<div class="card kpi">
		<span class="kpi-label">Investido <Hint text={glossary[0].text} /></span>
		<strong>{brl(data.cur.spendCents)}</strong>
		<Delta value={frac(data.changes.spend)} suffix={vs} />
		<Sparkline values={story.sparks.spend} />
	</div>
	<div class="card kpi">
		<span class="kpi-label">{labels.cost} <Hint text={glossary[2].text} /></span>
		<strong>{data.cur.costCents != null ? brl(data.cur.costCents) : '-'}</strong>
		<Delta value={frac(data.changes.cost)} suffix={vs} lowerIsBetter />
		<Sparkline values={story.sparks.cost} color="var(--color-success)" />
	</div>
	<div class="card kpi">
		<span class="kpi-label">Pessoas alcançadas <Hint text={glossary[3].text} /></span>
		<strong>{data.cur.reach != null ? int(data.cur.reach) : '-'}</strong>
		<span class="muted small">viram o anúncio</span>
	</div>
	{#if isAdmin}
		<div class="card kpi">
			<span class="kpi-label">CTR do link</span>
			<strong>{data.cur.ctr != null ? pct(data.cur.ctr, 2) : '-'}</strong>
			<span class="muted small">CPM {data.cur.cpmCents != null ? brl(data.cur.cpmCents) : '-'}</span
			>
		</div>
	{:else if story.best}
		<div class="card kpi">
			<span class="kpi-label">Melhor dia</span>
			<strong class="cap">{story.best.weekday}</strong>
			<span class="muted small">{int(story.best.results)} {labels.plural}</span>
		</div>
	{:else}
		<div class="card kpi">
			<span class="kpi-label">Melhor dia</span>
			<strong>-</strong>
			<span class="muted small">aparece quando houver resultado</span>
		</div>
	{/if}
</section>

{#if isAdmin}
	<section class="grid grid-4">
		<div class="card kpi">
			<span class="kpi-label">Frequência</span>
			<strong>{data.cur.frequency != null ? decimal(data.cur.frequency) : '-'}</strong>
			<span class="muted small"
				>{data.cur.frequency > 3 ? 'acima de 3, público saturando' : 'saudável até 3'}</span
			>
		</div>
		<div class="card kpi">
			<span class="kpi-label">Profundidade da conversa</span>
			<strong>{data.cur.depthRate != null ? pct(data.cur.depthRate, 0) : '-'}</strong>
			<span class="muted small">mandam 2+ mensagens</span>
		</div>
		<div class="card kpi">
			<span class="kpi-label">Meta de custo</span>
			<strong>{account.targetCostCents ? brl(account.targetCostCents) : '-'}</strong>
			<span class="muted small">custo alvo por resultado</span>
		</div>
		<div class="card kpi">
			<span class="kpi-label">Cliques no link</span>
			<strong>{int(data.cur.linkClicks || data.cur.clicks)}</strong>
			<span class="muted small">{int(data.cur.impressions)} impressões</span>
		</div>
	</section>
{/if}

<div class="duo">
	{#if data.pacing}
		<section class="card card-pad pacing">
			<h2 class="section-title">Orçamento do mês <Hint text={glossary[5].text} /></h2>
			<div class="pace-row">
				<Ring
					value={data.pacing.spentPct / 100}
					mark={Math.min(0.99, Number(data.today.slice(8, 10)) / daysInMonth(data.today))}
				>
					{Math.round(data.pacing.spentPct)}%
				</Ring>
				<p class="pace-text">
					<strong>{brl(data.pacing.spentCents)}</strong> de {brl(data.pacing.monthlyBudgetCents)}.
					No ritmo atual o mês fecha em <strong>{brl(data.pacing.projectedCents)}</strong>.
					{#if data.pacing.status === 'acima'}
						<span class="badge badge-warn">acima do planejado</span>
					{:else if data.pacing.status === 'abaixo'}
						<span class="badge badge-warn">abaixo do planejado</span>
					{:else}
						<span class="badge badge-success">no ritmo</span>
					{/if}
				</p>
			</div>
		</section>
	{/if}

	<section class="card card-pad">
		<h2 class="section-title">Do anúncio até virar cliente</h2>
		<p class="muted small">
			Cada ponto é uma etapa. Quanto maior o ponto, mais gente chegou até ali.
		</p>
		<RouteFunnel stages={story.funnel} />
		{#if !isAdmin && story.funnel.every((s) => s.key !== 'sales')}
			<p class="muted small funnel-ask">
				Falta uma etapa: quantos contatos viraram clientes.
				<a href="/painel/resultados">Contar pra gente</a>
			</p>
		{/if}
	</section>
</div>

{#if !isAdmin && story.activity.length}
	<section class="card card-pad">
		<h2 class="section-title">O que está acontecendo</h2>
		<ul class="timeline">
			{#each story.activity as item (item.text)}
				<li class="ico-{item.icon}">
					<span class="tl-dot"></span>
					<span>
						{item.text}
						{#if item.href}<a href={item.href}>Responder</a>{/if}
					</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="card card-pad">
	<h2 class="section-title">Evolução diária</h2>
	<TrendChart series={data.series} resultLabel={labels.plural} />
</section>

<section class="card card-pad">
	<h2 class="section-title">{isAdmin ? 'Campanhas' : 'Suas campanhas'}</h2>
	{#if shownCampaigns.length}
		{#if isAdmin}
			<div class="table-wrap">
				<table class="data">
					<thead>
						<tr>
							<th>Campanha</th>
							<th class="hide-sm">Situação</th>
							<th class="num">Investido</th>
							<th class="num">{labels.title}</th>
							<th class="num">{labels.cost}</th>
						</tr>
					</thead>
					<tbody>
						{#each shownCampaigns as c (c.id)}
							{@const [text, variant] = statusLabel(c.status)}
							<tr>
								<td>{c.name}</td>
								<td class="hide-sm"
									><span
										class="badge"
										class:badge-success={variant === 'success'}
										class:badge-warn={variant === 'warn'}
										class:badge-danger={variant === 'danger'}>{text}</span
									></td
								>
								<td class="num">{brl(c.spendCents)}</td>
								<td class="num">{int(c.results)}</td>
								<td class="num">{c.costCents != null ? brl(c.costCents) : '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="camp-list">
				{#each shownCampaigns as c (c.id)}
					{@const [text, variant] = statusLabel(c.status)}
					<article class="camp">
						<div class="camp-head">
							<span
								class="dot-s"
								class:ok={variant === 'success'}
								class:warn={variant === 'warn'}
								class:off={variant !== 'success' && variant !== 'warn'}
							></span>
							<strong>{c.name}</strong>
							<span class="muted small">{text}</span>
						</div>
						<div class="camp-nums">
							<div><span class="muted small">Investido</span><b>{brl(c.spendCents)}</b></div>
							<div><span class="muted small">{labels.title}</span><b>{int(c.results)}</b></div>
							<div>
								<span class="muted small">{labels.cost}</span><b
									>{c.costCents != null ? brl(c.costCents) : '-'}</b
								>
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{:else}
		<p class="muted">Nenhuma campanha com investimento neste período.</p>
	{/if}
</section>

<section class="card card-pad">
	<h2 class="section-title">{isAdmin ? 'Anúncios' : 'Anúncios que mais trouxeram resultado'}</h2>
	{#if shownAds.length && isAdmin}
		<div class="table-wrap">
			<table class="data">
				<thead>
					<tr>
						<th>Anúncio</th>
						<th>Situação</th>
						<th class="num">Investido</th>
						<th class="num">{labels.title}</th>
						<th class="num">{labels.cost}</th>
						<th class="num">CTR</th>
					</tr>
				</thead>
				<tbody>
					{#each shownAds as a (a.id)}
						{@const [text, variant] = statusLabel(a.status)}
						<tr>
							<td class="ad-cell">
								{#if a.thumbnailUrl}<img src={a.thumbnailUrl} alt="" loading="lazy" />{/if}
								<span>{a.name}</span>
							</td>
							<td
								><span
									class="badge"
									class:badge-success={variant === 'success'}
									class:badge-warn={variant === 'warn'}
									class:badge-danger={variant === 'danger'}>{text}</span
								></td
							>
							<td class="num">{brl(a.spendCents)}</td>
							<td class="num">{int(a.results)}</td>
							<td class="num">{a.costCents != null ? brl(a.costCents) : '-'}</td>
							<td class="num">{a.ctr != null ? pct(a.ctr, 2) : '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else if shownAds.length}
		<div class="gallery">
			{#each shownAds as a, i (a.id)}
				<article class="ad">
					<div class="thumb">
						{#if a.thumbnailUrl}<img src={a.thumbnailUrl} alt="" loading="lazy" />{/if}
						{#if i === 0}<span class="best">Campeão</span>{/if}
					</div>
					<div class="ad-body">
						<strong class="ad-name">{a.name}</strong>
						<span class="muted small"
							>{int(a.results)} {a.results === 1 ? labels.singular : labels.plural}</span
						>
						<span class="muted small">{a.costCents != null ? brl(a.costCents) : '-'} cada</span>
					</div>
				</article>
			{/each}
		</div>
	{:else}
		<p class="muted">Ainda não há anúncios com resultado neste período.</p>
	{/if}
</section>

{#if !isAdmin}
	<section class="card card-pad no-print">
		<h2 class="section-title">Entenda os números</h2>
		<div class="glossary">
			{#each glossary as g (g.term)}
				<details>
					<summary>{g.term}</summary>
					<p>{g.text}</p>
				</details>
			{/each}
		</div>
	</section>
{/if}

<style>
	.small {
		font-size: 0.8rem;
	}

	.cap {
		text-transform: capitalize;
	}

	/* Herói */
	.hero {
		position: relative;
		overflow: hidden;
		display: grid;
		grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
		gap: 1.5rem;
		padding: 1.5rem;
		border-radius: 14px;
		border: 1px solid var(--color-border);
		background: linear-gradient(135deg, #17130a 0%, #07070a 70%);
		/* Peça de marca: fica escura também no tema claro, então fixa as cores de texto. */
		--color-bg: #07070a;
		--color-text: #efefef;
		--color-text-dim: rgba(239, 239, 239, 0.62);
		--color-border: rgba(239, 239, 239, 0.12);
		--color-accent: #cda76b;
		--color-success: #4caf7d;
		--color-danger: #e5484d;
		color: var(--color-text);
		box-shadow: var(--shadow-md);
		--tone: var(--color-accent);
	}

	.hero::before {
		content: '';
		position: absolute;
		top: -90px;
		right: -70px;
		width: 280px;
		height: 280px;
		border-radius: 50%;
		background: var(--tone);
		opacity: 0.16;
		filter: blur(60px);
		pointer-events: none;
	}

	.hero.tone-good {
		--tone: var(--color-success);
	}

	.hero.tone-bad {
		--tone: var(--color-danger);
	}

	.hero.tone-idle {
		--tone: var(--color-text-dim);
	}

	.hero > * {
		position: relative;
	}

	.hero-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.live {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		color: var(--color-text-dim);
	}

	.live i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--color-success);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.35;
			transform: scale(0.8);
		}
	}

	.status {
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		color: var(--tone);
		background: color-mix(in srgb, var(--tone) 14%, transparent);
		border: 1px solid color-mix(in srgb, var(--tone) 35%, transparent);
	}

	.hero h2 {
		margin: 0.9rem 0 0.4rem;
		font-size: clamp(1.35rem, 3vw, 1.85rem);
		line-height: 1.15;
		letter-spacing: -0.02em;
	}

	.hero-detail {
		margin: 0;
		color: var(--color-text-dim);
		line-height: 1.55;
		max-width: 52ch;
	}

	.hero-num {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		justify-content: flex-end;
	}

	.hero-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-dim);
	}

	.hero-num > strong {
		font-size: 3.2rem;
		line-height: 1;
		letter-spacing: -0.04em;
	}

	.hero-spark {
		margin-top: 1.6rem;
	}

	.hero-foot {
		font-size: 0.68rem;
	}

	/* KPIs */
	.kpi {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.kpi:hover {
		border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
		transform: translateY(-1px);
	}

	.kpi-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: var(--color-text-dim);
	}

	.kpi > strong {
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}

	.duo {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.25rem;
		align-items: start;
	}

	.pace-row {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		margin-top: 0.8rem;
	}

	.pace-text {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.funnel-ask {
		margin: 1rem 0 0;
	}

	.funnel-ask a {
		color: var(--color-accent);
	}

	/* Linha do tempo */
	.timeline {
		list-style: none;
		margin: 0.6rem 0 0;
		padding: 0 0 0 0.35rem;
	}

	.timeline li {
		position: relative;
		display: flex;
		gap: 0.8rem;
		padding: 0.45rem 0 0.9rem;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.timeline li:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 4px;
		top: 1.3rem;
		bottom: -0.1rem;
		width: 2px;
		background-image: radial-gradient(circle, var(--color-border) 1px, transparent 1.5px);
		background-size: 2px 8px;
	}

	.tl-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-top: 0.3rem;
		flex-shrink: 0;
		background: var(--color-accent);
		box-shadow: 0 0 0 4px var(--color-accent-dim);
	}

	.ico-live .tl-dot {
		background: var(--color-success);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-success) 18%, transparent);
	}

	.timeline a {
		color: var(--color-accent);
		margin-left: 0.3rem;
	}

	/* Campanhas em cartões */
	.camp-list {
		display: grid;
		gap: 0.7rem;
		margin-top: 0.7rem;
	}

	.camp {
		padding: 0.85rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 10px;
		background: var(--color-bg);
	}

	.camp-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.dot-s {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--color-text-dim);
	}

	.dot-s.ok {
		background: var(--color-success);
	}

	.dot-s.warn {
		background: var(--color-accent);
	}

	.camp-nums {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
		margin-top: 0.7rem;
	}

	.camp-nums > div {
		display: flex;
		flex-direction: column;
	}

	.camp-nums b {
		font-size: 1.05rem;
	}

	/* Galeria de anúncios */
	.gallery {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.9rem;
		margin-top: 0.7rem;
	}

	.ad {
		border: 1px solid var(--color-border);
		border-radius: 10px;
		overflow: hidden;
		background: var(--color-bg);
	}

	.thumb {
		position: relative;
		aspect-ratio: 1;
		background: var(--color-bg-elevated);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.best {
		position: absolute;
		top: 8px;
		left: 8px;
		font-size: 0.68rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		background: var(--color-accent);
		color: #000;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
	}

	.ad-body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.65rem 0.75rem 0.8rem;
	}

	.ad-name {
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ad-cell {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 14rem;
	}

	.ad-cell img {
		width: 36px;
		height: 36px;
		object-fit: cover;
		border-radius: 6px;
		flex-shrink: 0;
	}

	/* Glossário */
	.glossary {
		margin-top: 0.6rem;
		display: grid;
	}

	details {
		border-top: 1px solid var(--color-border);
		padding: 0.7rem 0;
	}

	summary {
		cursor: pointer;
		font-weight: 600;
		font-size: 0.92rem;
	}

	details p {
		margin: 0.5rem 0 0;
		color: var(--color-text-dim);
		font-size: 0.88rem;
		line-height: 1.55;
	}

	@media (max-width: 760px) {
		.hero {
			grid-template-columns: minmax(0, 1fr);
			padding: 1.1rem;
		}

		.hero-num > strong {
			font-size: 2.6rem;
		}
	}
</style>
