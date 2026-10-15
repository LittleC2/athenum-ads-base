<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let syncing = $state(false);
	const when = (d) =>
		d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-';
</script>

<svelte:head>
	<title>Ajustes · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Ajustes</h1>
			<p class="sub">Conexões, segurança e histórico de ações.</p>
		</div>
	</header>

	{#if form?.ok}<p class="success-text" role="status">{form.ok}</p>{/if}

	<section class="card card-pad">
		<h2 class="section-title">Token da Meta</h2>
		{#if !data.token.configured}
			<p class="error-text">META_ADS_ACCESS_TOKEN não configurado.</p>
		{:else}
			<ul class="facts">
				<li>
					Tipo: <strong>{data.token.type ?? '-'}</strong>
					{#if data.token.type === 'USER'}<span class="badge badge-warn"
							>expira; prefira System User</span
						>{/if}
				</li>
				<li>
					Validade: <strong
						>{data.token.expiresAt
							? `${when(data.token.expiresAt)} (${data.token.daysLeft} dias)`
							: 'sem expiração'}</strong
					>
				</li>
				<li>Permissões: {data.token.scopes.join(', ') || '-'}</li>
				{#if data.token.missingScopes.length}<li class="error-text">
						Faltam: {data.token.missingScopes.join(', ')}
					</li>{/if}
			</ul>
			{#if data.token.warning}<div
					class="notice"
					class:danger={!data.token.ok}
					class:warn={data.token.ok}
				>
					{data.token.warning}
				</div>{/if}
		{/if}
		<details class="how">
			<summary>Como trocar por um token que não expira (System User)</summary>
			<ol>
				<li>
					No Meta Business Suite da sua BM, abra Configurações do negócio, Usuários, Usuários do
					sistema.
				</li>
				<li>
					Crie um usuário do sistema com função Admin e adicione as contas de anúncios dos clientes
					(controle total).
				</li>
				<li>
					Gere o token com as permissões ads_read, ads_management e business_management, validade
					"Nunca".
				</li>
				<li>
					Cole o token em META_ADS_ACCESS_TOKEN no servidor e reinicie. Esta tela confere o
					resultado.
				</li>
			</ol>
		</details>
	</section>

	{#if data.clientTokens.length}
		<section class="card card-pad">
			<h2 class="section-title">Tokens por cliente</h2>
			<ul class="facts">
				{#each data.clientTokens as t (t.tokenEnv)}
					<li>
						<strong>{t.tokenEnv}</strong> ({t.accounts.join(', ')}):
						{#if !t.configured}
							<span class="badge badge-danger">não configurado no servidor</span>
						{:else if t.ok}
							<span class="badge badge-success"
								>ok{t.type ? ' · ' + t.type : ''}{t.daysLeft != null
									? ' · expira em ' + t.daysLeft + ' dias'
									: ' · sem expiração'}</span
							>
						{:else}
							<span class="badge badge-warn">{t.warning ?? 'atenção'}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="card card-pad">
		<h2 class="section-title">IA (Claude)</h2>
		<p>
			{#if data.ai.configured}
				Conectada. Modelo: <strong>{data.ai.model}</strong>.
			{:else}
				<span class="badge badge-warn">sem ANTHROPIC_API_KEY</span>
				Relatórios usam texto de modelo; o copiloto e o laboratório de copys ficam desativados.
			{/if}
		</p>
	</section>

	<section class="card card-pad">
		<h2 class="section-title">Trava de escrita na Meta</h2>
		<p class="muted">
			Com a trava ligada, nada é criado, ativado, pausado ou alterado na Meta, nem por você nem pelo
			Claude. A leitura continua.
		</p>
		<form method="POST" action="?/travaEscrita" use:enhance>
			<input type="hidden" name="on" value={data.killSwitch ? '0' : '1'} />
			<button class="btn" class:btn-danger={!data.killSwitch} class:btn-secondary={data.killSwitch}>
				{data.killSwitch ? 'Liberar escrita' : 'Bloquear escrita'}
			</button>
			{#if data.killSwitch}<span class="badge badge-danger">bloqueada</span>{/if}
		</form>
	</section>

	<section class="card card-pad">
		<h2 class="section-title">Sincronização</h2>
		<p class="muted">As contas sincronizam sozinhas de 3 em 3 horas.</p>
		<form
			method="POST"
			action="?/sincronizarTudo"
			use:enhance={() => {
				syncing = true;
				return async ({ update }) => {
					await update();
					syncing = false;
				};
			}}
		>
			<button class="btn btn-secondary" disabled={syncing}
				>{syncing ? 'Sincronizando...' : 'Sincronizar todas agora'}</button
			>
		</form>
	</section>

	<section class="card card-pad">
		<h2 class="section-title">Últimas ações registradas</h2>
		<div class="table-wrap">
			<table class="data">
				<thead><tr><th>Quando</th><th>Ação</th><th>Alvo</th><th>Resultado</th></tr></thead>
				<tbody>
					{#each data.logs as l (l.id)}
						<tr>
							<td class="muted">{when(l.createdAt)}</td>
							<td>{l.action}</td>
							<td class="muted">{l.target ?? ''}</td>
							<td
								>{#if l.ok}<span class="badge badge-success">ok</span>{:else}<span
										class="badge badge-danger"
										title={l.error}>falhou</span
									>{/if}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

<style>
	.facts {
		list-style: none;
		margin: 0 0 0.75rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.9rem;
	}

	.how {
		margin-top: 0.75rem;
		font-size: 0.88rem;
	}

	.how ol {
		line-height: 1.6;
	}
</style>
