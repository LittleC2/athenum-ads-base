<script>
	import { ago, brl, int } from '$lib/format.js';
	import { RESULT_LABELS } from '$lib/metrics.js';
	import Delta from '$lib/components/Delta.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';

	let { data } = $props();

	const frac = (v) => (v == null ? null : v / 100);
	const accountsTotal = $derived(data.clients.reduce((n, c) => n + c.accounts.length, 0));

	function costTone(a) {
		if (a.cur.costCents == null) return '';
		if (a.targetCostCents && a.cur.costCents > a.targetCostCents * 1.3) return 'danger';
		if (a.costChange != null && a.costChange > 20) return 'warn';
		return '';
	}

	function mood(a) {
		if (a.lastSyncError || a.alerts.RED) return 'bad';
		if (a.alerts.YELLOW || costTone(a)) return 'watch';
		return a.cur.spendCents > 0 ? 'good' : 'idle';
	}

	const MOOD_LABEL = { good: 'Indo bem', watch: 'Observar', bad: 'Atenção', idle: 'Parada' };
</script>

<svelte:head>
	<title>Visão geral · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Visão geral</h1>
			<p class="sub">Últimos 7 dias de todos os clientes, contra os 7 anteriores.</p>
		</div>
		{#if !data.dashboardOnly}
			<div class="row">
				<a class="btn btn-secondary" href="/admin/acoes">
					Ações pendentes{#if data.pendingActions}
						({data.pendingActions}){/if}
				</a>
				<a class="btn" href="/admin/campanhas/nova">Nova campanha</a>
			</div>
		{/if}
	</header>

	<section class="grid grid-3">
		<div class="card sum">
			<span class="sum-label">Investido na semana</span>
			<strong>{brl(data.portfolio.spendCents)}</strong>
			<span class="muted small">somando todos os clientes</span>
		</div>
		<div class="card sum">
			<span class="sum-label">Contas no ar</span>
			<strong>{data.portfolio.accountsWithSpend} <i>de {accountsTotal}</i></strong>
			<span class="muted small">com investimento na semana</span>
		</div>
		<div class="card sum">
			<span class="sum-label">Indo bem</span>
			<strong>{data.portfolio.healthy} <i>de {data.portfolio.accountsWithSpend}</i></strong>
			<span class="muted small">sem alerta e com custo sob controle</span>
		</div>
	</section>

	<section class="card card-pad queue">
		<h2 class="section-title">Precisa de você agora</h2>
		{#if data.portfolio.queue.length}
			<ul>
				{#each data.portfolio.queue as q (q.who + q.text)}
					<li>
						<span class="qdot {q.level}"></span>
						<span class="qwho">{q.who}</span>
						<span class="qtext">{q.text}</span>
						<a class="qgo" href={q.href}>Abrir</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="ok-line">Nada esperando por você. Tudo no ritmo.</p>
		{/if}
	</section>

	{#if data.clients.length === 0}
		<p class="muted">
			Nenhum cliente ainda. <a href="/admin/clientes/novo">Cadastre o primeiro.</a>
		</p>
	{/if}

	<div class="clients">
		{#each data.clients as c (c.id)}
			<section class="card card-pad client">
				<div class="row head">
					<h2><a href="/admin/clientes/{c.id}">{c.name}</a></h2>
					{#if c.segment}<span class="muted small">{c.segment}</span>{/if}
				</div>
				{#each c.accounts as a (a.id)}
					{@const labels = RESULT_LABELS[a.resultType]}
					{@const m = mood(a)}
					<div class="account">
						<div class="metrics">
							<div>
								<span class="muted small">Investido</span>
								<strong>{brl(a.cur.spendCents)}</strong>
							</div>
							<div>
								<span class="muted small">{labels.title}</span>
								<strong>{int(a.cur.results)}</strong>
								<Delta value={frac(a.resultsChange)} suffix="vs semana anterior" />
							</div>
							<div>
								<span class="muted small">{labels.cost}</span>
								<strong class="tone-{costTone(a)}"
									>{a.cur.costCents != null ? brl(a.cur.costCents) : '-'}</strong
								>
								<Delta value={frac(a.costChange)} suffix="vs semana anterior" lowerIsBetter />
							</div>
							<div class="spark-col">
								<span class="mood mood-{m}">{MOOD_LABEL[m]}</span>
								<Sparkline values={a.spark} height={34} />
							</div>
						</div>
						<div class="foot">
							<span class="muted small">
								{a.name} · atualizado {ago(a.syncedAt)}
								{#if a.lastSyncError}<span class="error-text"> · erro: {a.lastSyncError}</span>{/if}
							</span>
							<span class="alerts-col">
								{#if a.alerts.RED}<span class="badge badge-danger">{a.alerts.RED} atenção</span
									>{/if}
								{#if a.alerts.YELLOW}<span class="badge badge-warn">{a.alerts.YELLOW} observar</span
									>{/if}
								{#if a.alerts.GREEN}<span class="badge badge-success"
										>{a.alerts.GREEN} oportunidade</span
									>{/if}
							</span>
						</div>
					</div>
				{:else}
					<p class="muted small">Sem conta de anúncios vinculada.</p>
				{/each}
			</section>
		{/each}
	</div>
</div>

<style>
	.sum {
		padding: 1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.sum-label {
		font-size: 0.75rem;
		color: var(--color-text-dim);
	}

	.sum strong {
		font-size: 1.7rem;
		letter-spacing: -0.02em;
	}

	.sum i {
		font-style: normal;
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--color-text-dim);
	}

	.queue ul {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
	}

	.queue li {
		display: grid;
		grid-template-columns: 10px 13rem minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: center;
		padding: 0.6rem 0;
		border-top: 1px solid var(--color-border);
		font-size: 0.9rem;
	}

	.queue li:first-child {
		border-top: 0;
	}

	.qdot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--color-accent);
	}

	.qdot.RED {
		background: var(--color-danger);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-danger) 18%, transparent);
	}

	.qwho {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.qtext {
		color: var(--color-text-dim);
	}

	.qgo {
		font-size: 0.8rem;
		color: var(--color-accent);
		text-decoration: none;
	}

	.qgo:hover {
		text-decoration: underline;
	}

	.ok-line {
		margin: 0.5rem 0 0;
		color: var(--color-success);
	}

	.clients {
		display: grid;
		gap: 0.9rem;
	}

	h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	h2 a {
		text-decoration: none;
	}

	h2 a:hover {
		color: var(--color-accent);
	}

	.client:hover {
		border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
	}

	.head {
		margin-bottom: 0.6rem;
	}

	.small {
		font-size: 0.75rem;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		align-items: start;
	}

	.metrics > div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}

	.metrics strong {
		font-size: 1.25rem;
		letter-spacing: -0.02em;
	}

	.tone-danger {
		color: var(--color-danger);
	}

	.tone-warn {
		color: var(--color-accent);
	}

	.spark-col {
		gap: 0.5rem !important;
	}

	.mood {
		align-self: flex-start;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		border: 1px solid currentColor;
	}

	.mood-good {
		color: var(--color-success);
	}

	.mood-watch {
		color: var(--color-accent);
	}

	.mood-bad {
		color: var(--color-danger);
	}

	.mood-idle {
		color: var(--color-text-dim);
	}

	.foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
		margin-top: 0.7rem;
	}

	.alerts-col {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	@media (max-width: 860px) {
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.queue li {
			grid-template-columns: 10px minmax(0, 1fr) auto;
		}

		.qwho {
			display: none;
		}
	}
</style>
