<script>
	let { data } = $props();
</script>

<svelte:head>
	<title>Clientes · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Clientes</h1>
			<p class="sub">Contas de anúncios e acessos ao portal.</p>
		</div>
		<a class="btn" href="/admin/clientes/novo">Novo cliente</a>
	</header>

	<section class="card card-pad">
		<div class="table-wrap">
			<table class="data">
				<thead>
					<tr>
						<th>Cliente</th>
						<th>Segmento</th>
						<th>Situação</th>
						<th class="num">Contas</th>
						<th class="num">Acessos</th>
					</tr>
				</thead>
				<tbody>
					{#each data.clients as c (c.id)}
						<tr>
							<td><a href="/admin/clientes/{c.id}">{c.name}</a></td>
							<td class="muted">{c.segment ?? '-'}</td>
							<td
								><span class="badge" class:badge-success={c.status === 'ATIVO'}
									>{c.status.toLowerCase()}</span
								></td
							>
							<td class="num">{c.accounts}</td>
							<td class="num">{c.logins}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
