<script>
	import { enhance } from '$app/forms';

	let { data } = $props();
	const SEVERITY = {
		RED: ['Atenção', 'danger'],
		YELLOW: ['Observar', 'warn'],
		GREEN: ['Oportunidade', 'success']
	};
	const since = (d) => new Date(d).toLocaleDateString('pt-BR');
</script>

<svelte:head>
	<title>Alertas · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Alertas</h1>
			<p class="sub">
				Recalculados a cada sincronização. Alertas que deixam de valer fecham sozinhos.
			</p>
		</div>
		<div class="chips">
			<a class="chip" class:active={!data.showDismissed} href="?">Abertos</a>
			<a class="chip" class:active={data.showDismissed} href="?dispensados=1">Dispensados</a>
		</div>
	</header>

	<section class="grid">
		{#each data.alerts as a (a.id)}
			<div class="card card-pad item">
				<span class="badge badge-{SEVERITY[a.severity][1]}">{SEVERITY[a.severity][0]}</span>
				<div class="body">
					<strong>{a.title}</strong>
					<p class="muted">{a.detail}</p>
					<p class="muted meta">
						<a href="/admin/clientes/{a.clientId}">{a.clientName}</a> · desde {since(a.firstSeenAt)}
						{#if a.visibleToClient}· <span class="badge">aparece pro cliente</span>{/if}
					</p>
				</div>
				<form method="POST" action={data.showDismissed ? '?/reabrir' : '?/dispensar'} use:enhance>
					<input type="hidden" name="id" value={a.id} />
					<button class="btn btn-secondary btn-sm"
						>{data.showDismissed ? 'Reabrir' : 'Dispensar'}</button
					>
				</form>
			</div>
		{:else}
			<p class="muted">
				{data.showDismissed ? 'Nenhum alerta dispensado.' : 'Nenhum alerta aberto. Tudo em ordem.'}
			</p>
		{/each}
	</section>
</div>

<style>
	.item {
		display: flex;
		gap: 0.85rem;
		align-items: flex-start;
	}

	.body {
		flex: 1;
	}

	.body p {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.meta {
		font-size: 0.78rem !important;
	}

	.item .badge {
		margin-top: 0.15rem;
		min-width: 6.4rem;
		justify-content: center;
		flex-shrink: 0;
	}

	@media (max-width: 700px) {
		.item {
			flex-direction: column;
			align-items: stretch;
			gap: 0.6rem;
		}

		.item .badge {
			align-self: flex-start;
			margin-top: 0;
		}

		.item form {
			align-self: flex-end;
		}
	}
</style>
