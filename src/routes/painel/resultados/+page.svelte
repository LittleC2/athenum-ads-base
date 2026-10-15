<script>
	import { enhance } from '$app/forms';
	import { brl, int } from '$lib/format.js';
	import { fullBR } from '$lib/dates.js';
	import { RESULT_LABELS } from '$lib/metrics.js';

	let { data, form } = $props();
	const labels = $derived(RESULT_LABELS[data.resultType]);
</script>

<svelte:head>
	<title>Resultados · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>O que virou cliente</h1>
			<p class="sub">
				Conte quantos contatos viraram atendimento ou venda. Com isso calculamos quanto custa, de
				verdade, cada cliente novo.
			</p>
		</div>
	</header>

	<form class="card card-pad form-grid" method="POST" use:enhance>
		<div class="field">
			<label for="start">Período, de</label>
			<input id="start" name="start" type="date" value={data.defaults.start} required />
		</div>
		<div class="field">
			<label for="end">até</label>
			<input id="end" name="end" type="date" value={data.defaults.end} required />
		</div>
		<div class="field">
			<label for="qualified">Contatos que tinham interesse de verdade</label>
			<input id="qualified" name="qualified" inputmode="numeric" placeholder="Ex: 20" />
		</div>
		<div class="field">
			<label for="sales">Contatos que viraram cliente ou consulta</label>
			<input id="sales" name="sales" inputmode="numeric" placeholder="Ex: 6" />
		</div>
		<div class="field">
			<label for="revenue">Valor vendido no período (R$)</label>
			<input id="revenue" name="revenue" inputmode="decimal" placeholder="Ex: 3.000,00" />
			<span class="hint">Opcional.</span>
		</div>
		<div class="field full">
			<label for="note">Observação</label>
			<textarea id="note" name="note" rows="2" maxlength="500"></textarea>
		</div>

		{#if form?.error}<p class="error-text full" role="alert">{form.error}</p>{/if}
		{#if form?.saved}<p class="success-text full" role="status">Informação salva. Obrigado!</p>{/if}
		<div class="full"><button class="btn" type="submit">Salvar</button></div>
	</form>

	{#if data.feedbacks.length}
		<section class="card card-pad">
			<h2 class="section-title">Seu histórico</h2>
			<div class="table-wrap">
				<table class="data">
					<thead>
						<tr>
							<th>Período</th>
							<th class="num">Investido</th>
							<th class="num">{labels.title}</th>
							<th class="num">Viraram cliente</th>
							<th class="num">Custo por cliente</th>
						</tr>
					</thead>
					<tbody>
						{#each data.feedbacks as f (f.id)}
							<tr>
								<td>{fullBR(f.periodStart)} a {fullBR(f.periodEnd)}</td>
								<td class="num">{brl(f.spendCents)}</td>
								<td class="num">{int(f.results)}</td>
								<td class="num">{f.sales ?? '-'}</td>
								<td class="num">{f.sales ? brl(Math.round(f.spendCents / f.sales)) : '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>
