<script>
	import { fullBR } from '$lib/dates.js';

	let { data } = $props();
</script>

<svelte:head>
	<title>Relatórios · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Relatórios</h1>
			<p class="sub">Resumos preparados pela Athenum sobre o resultado dos seus anúncios.</p>
		</div>
	</header>

	{#if data.reports.length}
		<ul class="list">
			{#each data.reports as r (r.id)}
				<li>
					<a class="card item" href="/painel/relatorios/{r.id}">
						<strong>{r.title}</strong>
						<span class="muted">{fullBR(r.periodStart)} a {fullBR(r.periodEnd)}</span>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="muted">Ainda não há relatórios publicados. O primeiro chega em breve.</p>
	{/if}
</div>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.item {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		text-decoration: none;
		flex-wrap: wrap;
	}

	.item:hover {
		border-color: var(--color-accent);
	}
</style>
