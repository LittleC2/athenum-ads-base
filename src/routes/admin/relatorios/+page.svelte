<script>
	import { enhance } from '$app/forms';
	import { fullBR } from '$lib/dates.js';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head>
	<title>Relatórios · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Relatórios</h1>
			<p class="sub">
				O Claude escreve o rascunho; você revisa e publica para o portal do cliente.
				{#if !data.withAI}<span class="badge badge-warn"
						>sem chave da IA: usando texto de modelo</span
					>{/if}
			</p>
		</div>
	</header>

	<form
		class="card card-pad form-grid"
		method="POST"
		action="?/gerar"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<div class="field">
			<label for="acc">Conta</label>
			<select id="acc" name="accountId" required>
				{#each data.accounts as a (a.id)}
					<option value={a.id}>{a.clientName} · {a.name}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="preset">Período</label>
			<select id="preset" name="preset">
				{#each data.presets as [key, label] (key)}
					<option value={key}>{label}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="since">Ou datas livres: de</label><input id="since" name="since" type="date" />
		</div>
		<div class="field">
			<label for="until">até</label><input id="until" name="until" type="date" />
		</div>
		{#if form?.error}<p class="error-text full" role="alert">{form.error}</p>{/if}
		<div class="full">
			<button class="btn" disabled={busy}>{busy ? 'Gerando relatório...' : 'Gerar rascunho'}</button
			>
		</div>
	</form>

	<section class="card card-pad">
		<div class="table-wrap">
			<table class="data">
				<thead>
					<tr><th>Relatório</th><th>Cliente</th><th>Período</th><th>Situação</th><th>Texto</th></tr>
				</thead>
				<tbody>
					{#each data.reports as r (r.id)}
						<tr>
							<td><a href="/admin/relatorios/{r.id}">{r.title}</a></td>
							<td>{r.clientName}</td>
							<td class="muted">{fullBR(r.periodStart)} a {fullBR(r.periodEnd)}</td>
							<td
								><span class="badge" class:badge-success={r.status === 'PUBLISHED'}
									>{r.status === 'PUBLISHED' ? 'publicado' : 'rascunho'}</span
								></td
							>
							<td class="muted">{r.generatedBy === 'claude' ? 'Claude' : 'modelo'}</td>
						</tr>
					{:else}
						<tr><td colspan="5" class="muted">Nenhum relatório ainda.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
