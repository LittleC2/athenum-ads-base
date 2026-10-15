<script>
	import Dashboard from '$lib/components/Dashboard.svelte';
	import RichText from '$lib/components/RichText.svelte';
	import { fullBR } from '$lib/dates.js';

	let { data } = $props();
</script>

<svelte:head>
	<title>Painel · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Seus anúncios</h1>
			<p class="sub">{data.account.name}</p>
		</div>
		{#if data.accounts.length > 1}
			<div class="chips no-print">
				{#each data.accounts as a (a.id)}
					<a
						class="chip"
						class:active={a.id === data.account.id}
						href="?conta={a.id}&periodo={data.preset}">{a.name}</a
					>
				{/each}
			</div>
		{/if}
	</header>

	{#if data.report}
		<section class="card card-pad">
			<h2 class="section-title">Resumo da semana</h2>
			<p class="muted small">
				{data.report.title} · {fullBR(data.report.periodStart)} a {fullBR(data.report.periodEnd)}
			</p>
			<RichText text={data.report.clientSummary} />
			<a class="btn-secondary btn no-print" href="/painel/relatorios/{data.report.id}"
				>Ver relatório completo</a
			>
		</section>
	{/if}

	<Dashboard
		data={data.dashboard}
		account={data.account}
		alerts={data.alerts}
		preset={data.preset}
		mode="client"
		basePath="/painel"
	/>
</div>

<style>
	.small {
		font-size: 0.8rem;
		margin: 0 0 0.75rem;
	}
</style>
