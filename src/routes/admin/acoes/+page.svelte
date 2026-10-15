<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let busy = $state('');
	const when = (d) =>
		new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
	const STATUS = {
		APPROVED: ['aprovada', ''],
		EXECUTED: ['executada', 'success'],
		REJECTED: ['rejeitada', ''],
		FAILED: ['falhou', 'danger'],
		PENDING: ['pendente', 'warn']
	};

	function submit(id) {
		return () => {
			busy = id;
			return async ({ update }) => {
				await update();
				busy = '';
			};
		};
	}
</script>

<svelte:head>
	<title>Ações · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Ações</h1>
			<p class="sub">
				Tudo que o copiloto propõe espera aqui. Nada muda na Meta sem a sua aprovação.
			</p>
		</div>
	</header>

	{#if form?.ok}<p class="success-text" role="status">{form.ok}</p>{/if}
	{#if form?.error}<p class="error-text" role="alert">{form.error}</p>{/if}

	<section>
		<h2 class="section-title">Aguardando aprovação</h2>
		{#each data.pending as a (a.id)}
			<div class="card card-pad item">
				<div class="body">
					<div class="row">
						<strong>{a.typeLabel}</strong>
						{#if a.clientName}<span class="muted">· {a.clientName}</span>{/if}
						<span class="badge">{a.source === 'COPILOT' ? 'proposta do Claude' : 'manual'}</span>
					</div>
					<p>{a.summary}</p>
					<p class="muted small">{when(a.createdAt)}</p>
				</div>
				<div class="controls">
					<form method="POST" action="?/aprovar" use:enhance={submit(a.id)}>
						<input type="hidden" name="id" value={a.id} />
						{#if a.spendsMoney}
							<label class="inline"
								><input type="checkbox" name="confirm" /> Confirmo que isto mexe em gasto</label
							>
						{/if}
						<button class="btn" disabled={busy === a.id}
							>{busy === a.id ? 'Executando...' : 'Aprovar e executar'}</button
						>
					</form>
					<form method="POST" action="?/rejeitar" use:enhance={submit(`r-${a.id}`)}>
						<input type="hidden" name="id" value={a.id} />
						<button class="btn btn-secondary">Rejeitar</button>
					</form>
				</div>
			</div>
		{:else}
			<p class="muted">Nenhuma ação pendente.</p>
		{/each}
	</section>

	<section class="card card-pad">
		<h2 class="section-title">Histórico</h2>
		<div class="table-wrap">
			<table class="data">
				<thead
					><tr><th>Quando</th><th>Ação</th><th>Cliente</th><th>Detalhe</th><th>Situação</th></tr
					></thead
				>
				<tbody>
					{#each data.history as a (a.id)}
						{@const [text, variant] = STATUS[a.status]}
						<tr>
							<td class="muted">{when(a.createdAt)}</td>
							<td>{a.typeLabel}</td>
							<td>{a.clientName}</td>
							<td class="muted"
								>{a.summary}{#if a.error}<br /><span class="error-text">{a.error}</span>{/if}</td
							>
							<td
								><span
									class="badge"
									class:badge-success={variant === 'success'}
									class:badge-danger={variant === 'danger'}>{text}</span
								></td
							>
						</tr>
					{:else}
						<tr><td colspan="5" class="muted">Sem histórico ainda.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

<style>
	.item {
		display: flex;
		gap: 1rem;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.6rem;
		flex-wrap: wrap;
	}

	.body {
		flex: 1;
		min-width: 14rem;
	}

	.body p {
		margin: 0.35rem 0 0;
		line-height: 1.5;
	}

	.small {
		font-size: 0.75rem;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 14rem;
	}

	.inline {
		display: flex;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.8rem;
		margin-bottom: 0.4rem;
	}

	.inline input {
		width: auto;
	}

	.controls .btn {
		width: 100%;
	}
</style>
