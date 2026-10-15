<script>
	import { enhance } from '$app/forms';
	import RichText from '$lib/components/RichText.svelte';
	import { fullBR } from '$lib/dates.js';

	let { data, form } = $props();
	const r = $derived(data.report);
	let summary = $state('');
	let internal = $state('');
	let title = $state('');
	let seeded = $state('');

	// Preenche os campos quando o relatório carrega (e quando troca de relatório).
	$effect(() => {
		if (seeded !== r.id) {
			title = r.title;
			summary = r.clientSummary;
			internal = r.internalAnalysis;
			seeded = r.id;
		}
	});

	const PRIORITY = { alta: 'danger', media: 'warn', baixa: '' };
</script>

<svelte:head>
	<title>{r.title} · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>{r.title}</h1>
			<p class="sub">
				{r.clientName} · {fullBR(r.periodStart)} a {fullBR(r.periodEnd)} ·
				<span class="badge" class:badge-success={r.status === 'PUBLISHED'}
					>{r.status === 'PUBLISHED' ? 'publicado' : 'rascunho'}</span
				>
				<span class="muted"
					>· escrito por {r.generatedBy === 'claude' ? 'Claude' : 'texto de modelo'}</span
				>
			</p>
		</div>
		<a class="btn btn-secondary" href="/admin/relatorios">Voltar</a>
	</header>

	{#if form?.ok}<p class="success-text" role="status">{form.ok}</p>{/if}
	{#if form?.error}<p class="error-text" role="alert">{form.error}</p>{/if}

	<form
		method="POST"
		action="?/salvar"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
		class="grid"
	>
		<div class="card card-pad">
			<div class="field">
				<label for="title">Título</label>
				<input id="title" name="title" bind:value={title} />
			</div>
		</div>

		<div class="grid grid-2">
			<div class="card card-pad">
				<h2 class="section-title">Texto do cliente (editável)</h2>
				<div class="field">
					<textarea name="clientSummary" rows="14" bind:value={summary}></textarea>
					<span class="hint">Aceita **negrito**, listas com hífen e subtítulos com ##.</span>
				</div>
			</div>
			<div class="card card-pad">
				<h2 class="section-title">Como o cliente vai ver</h2>
				<RichText text={summary} />
			</div>
		</div>

		<div class="card card-pad">
			<h2 class="section-title">Análise interna (o cliente não vê)</h2>
			<div class="field">
				<textarea name="internalAnalysis" rows="14" bind:value={internal}></textarea>
			</div>
		</div>

		<div class="row">
			<button class="btn" type="submit">Salvar alterações</button>
		</div>
	</form>

	{#if r.recommendations.length}
		<section class="card card-pad">
			<h2 class="section-title">Recomendações</h2>
			<ul class="recs">
				{#each r.recommendations as rec, i (i)}
					<li>
						<span class="badge badge-{PRIORITY[rec.priority] || ''}">{rec.priority}</span>
						<div>
							<strong>{rec.action}</strong>
							<p class="muted">{rec.reason}</p>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="row">
		{#if r.status === 'DRAFT'}
			<form method="POST" action="?/publicar" use:enhance>
				<button class="btn">Publicar no portal do cliente</button>
			</form>
		{:else}
			<form method="POST" action="?/despublicar" use:enhance>
				<button class="btn btn-secondary">Tirar do portal</button>
			</form>
		{/if}
		<form method="POST" action="?/excluir" use:enhance>
			<button class="btn btn-danger">Excluir</button>
		</form>
	</section>
</div>

<style>
	.recs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.recs li {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.recs p {
		margin: 0.15rem 0 0;
		font-size: 0.85rem;
	}

	textarea {
		min-height: 14rem;
		line-height: 1.5;
	}
</style>
