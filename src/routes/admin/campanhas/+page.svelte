<script>
	import { brl } from '$lib/format.js';

	let { data } = $props();

	const STATUS = {
		DRAFT: ['rascunho', ''],
		REVIEW: ['em revisão', 'warn'],
		UPLOADING: ['enviando', 'warn'],
		UPLOADED: ['na Meta, pausada', 'success'],
		ACTIVE: ['ativa', 'success'],
		FAILED: ['com falha', 'danger']
	};
	const when = (d) =>
		new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
</script>

<svelte:head>
	<title>Campanhas · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Campanhas</h1>
			<p class="sub">
				Monte aqui, revise e envie para a Meta sempre pausada. Ativar é um passo separado.
			</p>
		</div>
		<a class="btn" href="/admin/campanhas/nova">Nova campanha</a>
	</header>

	<section class="card card-pad">
		<div class="table-wrap">
			<table class="data">
				<thead
					><tr
						><th>Campanha</th><th>Cliente</th><th>Objetivo</th><th class="num">Orçamento/dia</th><th
							>Situação</th
						><th>Atualizada</th></tr
					></thead
				>
				<tbody>
					{#each data.drafts as d (d.id)}
						{@const [text, variant] = STATUS[d.status]}
						<tr>
							<td><a href="/admin/campanhas/{d.id}">{d.name}</a></td>
							<td>{d.clientName}</td>
							<td class="muted">{d.objective}</td>
							<td class="num">{brl(d.dailyBudgetCents)}</td>
							<td
								><span
									class="badge"
									class:badge-success={variant === 'success'}
									class:badge-warn={variant === 'warn'}
									class:badge-danger={variant === 'danger'}>{text}</span
								></td
							>
							<td class="muted">{when(d.updatedAt)}</td>
						</tr>
					{:else}
						<tr><td colspan="6" class="muted">Nenhuma campanha montada ainda.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
