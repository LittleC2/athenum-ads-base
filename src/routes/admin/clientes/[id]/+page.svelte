<script>
	import { enhance } from '$app/forms';
	import Dashboard from '$lib/components/Dashboard.svelte';
	import { brl, int, pct } from '$lib/format.js';
	import { fullBR } from '$lib/dates.js';

	let { data, form } = $props();
	let busy = $state('');

	const centsToField = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
	const base = $derived(`/admin/clientes/${data.client.id}`);
	const when = (d) =>
		d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';

	function submit(name) {
		return () => {
			busy = name;
			return async ({ update }) => {
				await update({ reset: false });
				busy = '';
			};
		};
	}
</script>

<svelte:head>
	<title>{data.client.name} · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>{data.client.name}</h1>
			<p class="sub">
				{data.client.segment ?? 'Sem segmento'} ·
				<span class="badge" class:badge-success={data.client.status === 'ATIVO'}
					>{data.client.status.toLowerCase()}</span
				>
			</p>
		</div>
		<div class="row">
			<a class="btn btn-secondary" href="/admin/campanhas/nova?cliente={data.client.id}"
				>Nova campanha</a
			>
			<a class="btn btn-secondary" href="/admin/relatorios?cliente={data.client.id}">Relatórios</a>
		</div>
	</header>

	<nav class="tabs" aria-label="Seções do cliente">
		{#each [['painel', 'Painel'], ['contas', 'Contas e resultado'], ['brief', 'Briefing'], ['acessos', 'Acessos']] as [key, label] (key)}
			<a href="{base}?aba={key}" class:active={data.aba === key}>{label}</a>
		{/each}
	</nav>

	{#if form?.ok}<p class="success-text" role="status">{form.ok}</p>{/if}
	{#if form?.error}<p class="error-text" role="alert">{form.error}</p>{/if}

	{#if data.aba === 'painel'}
		{#if !data.account}
			<p class="muted">Nenhuma conta vinculada. Vá em "Contas e resultado" para vincular.</p>
		{:else}
			{#if data.accounts.length > 1}
				<div class="chips">
					{#each data.accounts as a (a.id)}
						<a
							class="chip"
							class:active={a.id === data.account.id}
							href="{base}?aba=painel&conta={a.id}&periodo={data.preset}">{a.name}</a
						>
					{/each}
				</div>
			{/if}
			<Dashboard
				data={data.dashboard}
				account={data.account}
				alerts={data.alerts}
				preset={data.preset}
				mode="admin"
				basePath={`${base}`}
			/>

			<section class="grid grid-2">
				<div class="card card-pad">
					<h2 class="section-title">Idade e gênero</h2>
					<div class="table-wrap">
						<table class="data">
							<thead
								><tr
									><th>Público</th><th class="num">Investido</th><th class="num">%</th><th
										class="num">Resultados</th
									><th class="num">Custo</th></tr
								></thead
							>
							<tbody>
								{#each data.age.slice(0, 12) as r (r.key)}
									<tr
										><td>{r.key}</td><td class="num">{brl(r.spendCents)}</td><td class="num"
											>{pct(r.share, 0)}</td
										><td class="num">{int(r.results)}</td><td class="num"
											>{r.costCents != null ? brl(r.costCents) : '-'}</td
										></tr
									>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
				<div class="card card-pad">
					<h2 class="section-title">Posicionamento</h2>
					<div class="table-wrap">
						<table class="data">
							<thead
								><tr
									><th>Onde aparece</th><th class="num">Investido</th><th class="num">%</th><th
										class="num">Resultados</th
									><th class="num">Custo</th></tr
								></thead
							>
							<tbody>
								{#each data.placement.slice(0, 12) as r (r.key)}
									<tr
										><td>{r.key}</td><td class="num">{brl(r.spendCents)}</td><td class="num"
											>{pct(r.share, 0)}</td
										><td class="num">{int(r.results)}</td><td class="num"
											>{r.costCents != null ? brl(r.costCents) : '-'}</td
										></tr
									>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</section>
		{/if}
	{/if}

	{#if data.aba === 'contas'}
		<section class="card card-pad">
			<h2 class="section-title">Dados do cliente</h2>
			<form
				method="POST"
				action="?/salvarCliente"
				class="form-grid"
				use:enhance={submit('cliente')}
			>
				<div class="field">
					<label for="c-name">Nome</label><input
						id="c-name"
						name="name"
						value={data.client.name}
						required
					/>
				</div>
				<div class="field">
					<label for="c-seg">Segmento</label><input
						id="c-seg"
						name="segment"
						value={data.client.segment ?? ''}
					/>
				</div>
				<div class="field">
					<label for="c-status">Situação</label>
					<select id="c-status" name="status" value={data.client.status}>
						<option value="ATIVO">Ativo</option><option value="PAUSADO">Pausado</option><option
							value="ENCERRADO">Encerrado</option
						>
					</select>
				</div>
				<div class="field full">
					<label for="c-notes">Anotações internas</label><textarea
						id="c-notes"
						name="notes"
						rows="2">{data.client.notes ?? ''}</textarea
					>
				</div>
				<div class="full">
					<button class="btn btn-secondary" disabled={busy === 'cliente'}>Salvar cliente</button>
				</div>
			</form>
		</section>

		{#each data.accounts as a (a.id)}
			<section class="card card-pad">
				<h2 class="section-title">{a.name} <span class="muted">· {a.externalId}</span></h2>
				<p class="muted small">
					Sincronizada {when(a.syncedAt)}
					{#if a.lastSyncError}<span class="error-text"> · {a.lastSyncError}</span>{/if}
				</p>
				{#if data.tokens?.[a.tokenEnv ?? 'default']}
					{@const t = data.tokens[a.tokenEnv ?? 'default']}
					<p class="small">
						Token: <strong>{a.tokenEnv ?? 'geral (META_ADS_ACCESS_TOKEN)'}</strong>
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
					</p>
				{/if}
				<form
					method="POST"
					action="?/salvarConta"
					class="form-grid"
					use:enhance={submit(`conta-${a.id}`)}
				>
					<input type="hidden" name="accountId" value={a.id} />
					<div class="field">
						<label for="n-{a.id}">Nome</label><input id="n-{a.id}" name="name" value={a.name} />
					</div>
					<div class="field">
						<label for="r-{a.id}">O que conta como resultado</label>
						<select id="r-{a.id}" name="resultType" value={a.resultType}>
							<option value="LEAD_FORM">Lead de formulário</option>
							<option value="WHATSAPP">Conversa no WhatsApp</option>
							<option value="PURCHASE">Compra</option>
							<option value="LINK_CLICK">Clique no link</option>
						</select>
					</div>
					<div class="field">
						<label for="m-{a.id}">Orçamento mensal (R$)</label><input
							id="m-{a.id}"
							name="monthlyBudget"
							inputmode="decimal"
							value={centsToField(a.monthlyBudgetCents)}
						/>
					</div>
					<div class="field">
						<label for="t-{a.id}">Custo alvo por resultado (R$)</label><input
							id="t-{a.id}"
							name="targetCost"
							inputmode="decimal"
							value={centsToField(a.targetCostCents)}
						/>
					</div>
					<div class="field">
						<label for="d-{a.id}">Teto de orçamento diário em campanha nova (R$)</label>
						<input
							id="d-{a.id}"
							name="maxDailyBudget"
							inputmode="decimal"
							value={centsToField(a.maxDailyBudgetCents)}
						/>
						<span class="hint">Trava de segurança: o fluxo de campanha recusa acima disso.</span>
					</div>
					<div class="field">
						<label for="p-{a.id}">ID da página do Facebook</label><input
							id="p-{a.id}"
							name="pageId"
							value={a.pageId ?? ''}
						/>
					</div>
					<div class="field">
						<label for="i-{a.id}">ID do Instagram (opcional)</label><input
							id="i-{a.id}"
							name="igUserId"
							value={a.igUserId ?? ''}
						/>
					</div>
					<div class="field">
						<label for="adv-{a.id}">ID do anunciante verificado (opcional)</label>
						<input
							id="adv-{a.id}"
							name="advertiserIdentityId"
							value={a.advertiserIdentityId ?? ''}
							placeholder="Ex: 123456789012345"
							autocomplete="off"
						/>
						<span class="hint"
							>Algumas contas exigem anunciante verificado para criar campanha. O número fica em
							Configurações do negócio, Autorizações e verificações, "Identificação".</span
						>
					</div>
					<div class="field">
						<label for="tk-{a.id}">Token deste cliente (opcional)</label>
						<input
							id="tk-{a.id}"
							name="tokenEnv"
							value={a.tokenEnv ?? ''}
							placeholder="META_TOKEN_NOME"
							autocomplete="off"
						/>
						<span class="hint"
							>Nome da variável no servidor com o token só desta conta. Vazio usa o token geral. O
							valor do token nunca é guardado aqui.</span
						>
					</div>
					<div class="field">
						<label
							><input type="checkbox" name="active" checked={a.active} /> Conta ativa (sincroniza)</label
						>
					</div>
					<div class="full row">
						<button class="btn" disabled={busy === `conta-${a.id}`}>Salvar conta</button>
					</div>
				</form>
				<div class="row" style="margin-top:0.75rem">
					<form method="POST" action="?/sincronizar" use:enhance={submit(`sync-${a.id}`)}>
						<input type="hidden" name="accountId" value={a.id} />
						<button class="btn btn-secondary" disabled={busy === `sync-${a.id}`}
							>{busy === `sync-${a.id}` ? 'Sincronizando...' : 'Sincronizar agora'}</button
						>
					</form>
					<form method="POST" action="?/sincronizar" use:enhance={submit(`full-${a.id}`)}>
						<input type="hidden" name="accountId" value={a.id} />
						<input type="hidden" name="full" value="1" />
						<button class="btn btn-secondary" disabled={busy === `full-${a.id}`}
							>{busy === `full-${a.id}`
								? 'Recarregando histórico (pode levar minutos)...'
								: 'Recarregar histórico completo'}</button
						>
					</form>
				</div>
			</section>
		{/each}

		<section class="card card-pad">
			<h2 class="section-title">Vincular conta de anúncios</h2>
			{#if data.discoverError}
				<p class="error-text">Não consegui listar as contas da Meta: {data.discoverError}</p>
			{/if}
			<form
				method="POST"
				action="?/vincularConta"
				class="form-grid"
				use:enhance={submit('vincular')}
			>
				<div class="field">
					<label for="v-ext">Conta que o token enxerga</label>
					<select id="v-ext" name="externalId">
						<option value="">Escolha uma conta</option>
						{#each data.discovered.filter((d) => !d.linked) as d (d.externalId)}
							<option value={d.externalId}
								>{d.name} {d.business ? `(${d.business})` : ''} · {d.externalId}</option
							>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="v-man">Ou digite o ID da conta</label>
					<input id="v-man" name="externalIdManual" placeholder="act_123456789 ou só os números" />
					<span class="hint"
						>Use quando o cliente tem token próprio e a conta não aparece na lista acima.</span
					>
				</div>
				<div class="field">
					<label for="v-tok">Token deste cliente (opcional)</label>
					<input id="v-tok" name="tokenEnv" placeholder="META_TOKEN_NOME" autocomplete="off" />
				</div>
				<div class="field">
					<label for="v-name">Nome de exibição</label><input
						id="v-name"
						name="name"
						placeholder="Igual ao nome da conta"
					/>
				</div>
				<div class="full"><button class="btn" disabled={busy === 'vincular'}>Vincular</button></div>
			</form>
		</section>

		{#if data.feedbacks.length}
			<section class="card card-pad">
				<h2 class="section-title">O que o cliente informou que virou venda</h2>
				<div class="table-wrap">
					<table class="data">
						<thead
							><tr
								><th>Período</th><th class="num">Com interesse</th><th class="num"
									>Viraram cliente</th
								><th class="num">Valor vendido</th><th>Observação</th></tr
							></thead
						>
						<tbody>
							{#each data.feedbacks as f (f.id)}
								<tr>
									<td>{fullBR(f.periodStart)} a {fullBR(f.periodEnd)}</td>
									<td class="num">{f.qualified ?? '-'}</td>
									<td class="num">{f.sales ?? '-'}</td>
									<td class="num">{f.revenueCents != null ? brl(f.revenueCents) : '-'}</td>
									<td class="muted">{f.note ?? ''}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	{/if}

	{#if data.aba === 'brief'}
		<section class="card card-pad">
			<h2 class="section-title">Briefing usado pela IA</h2>
			<p class="muted small">
				O Claude lê isto ao propor campanhas, escrever copys e redigir relatórios.
			</p>
			<form method="POST" action="?/salvarBrief" class="form-grid" use:enhance={submit('brief')}>
				<div class="field full">
					<label for="b-offer">Oferta e serviço anunciado</label><textarea
						id="b-offer"
						name="offer"
						rows="2">{data.brief?.offer ?? ''}</textarea
					>
				</div>
				<div class="field full">
					<label for="b-aud">Público</label><textarea id="b-aud" name="audience" rows="2"
						>{data.brief?.audience ?? ''}</textarea
					>
				</div>
				<div class="field full">
					<label for="b-tone">Tom de voz</label><textarea id="b-tone" name="tone" rows="2"
						>{data.brief?.tone ?? ''}</textarea
					>
				</div>
				<div class="field">
					<label for="b-ticket">Ticket do serviço de entrada (R$)</label><input
						id="b-ticket"
						name="ticket"
						inputmode="decimal"
						value={centsToField(data.brief?.ticketCents)}
					/>
				</div>
				<div class="field">
					<label for="b-close">Taxa de fechamento (%)</label><input
						id="b-close"
						name="closeRate"
						inputmode="decimal"
						value={data.brief?.closeRatePct ?? ''}
					/>
				</div>
				<div class="field full">
					<label for="b-res">Restrições (o que nunca dizer)</label><textarea
						id="b-res"
						name="restrictions"
						rows="2">{data.brief?.restrictions ?? ''}</textarea
					>
				</div>
				<div class="field full">
					<label for="b-extra">Outras informações</label><textarea
						id="b-extra"
						name="extra"
						rows="3">{data.brief?.extra ?? ''}</textarea
					>
				</div>
				<div class="full">
					<button class="btn" disabled={busy === 'brief'}>Salvar briefing</button>
				</div>
			</form>
		</section>
	{/if}

	{#if data.aba === 'acessos'}
		{#if form?.novaSenha}
			<div class="notice warn" role="status">
				<strong>Senha temporária de {form.novaSenha.email}:</strong>
				<code class="pw">{form.novaSenha.senha}</code>
				<div class="muted">
					Copie agora e envie ao cliente. Ela não aparece de novo e será trocada no primeiro acesso.
				</div>
			</div>
		{/if}

		<section class="card card-pad">
			<h2 class="section-title">Logins do portal</h2>
			{#if data.users.length}
				<div class="table-wrap">
					<table class="data">
						<thead
							><tr><th>Nome</th><th>E-mail</th><th>Último acesso</th><th>Situação</th><th></th></tr
							></thead
						>
						<tbody>
							{#each data.users as u (u.id)}
								<tr>
									<td>{u.name}</td>
									<td>{u.email}</td>
									<td class="muted">{when(u.lastLoginAt)}</td>
									<td
										><span class="badge" class:badge-success={u.active}
											>{u.active ? 'ativo' : 'desativado'}</span
										>{#if u.mustChangePassword}
											<span class="badge badge-warn">senha temporária</span>{/if}</td
									>
									<td class="row">
										<form
											method="POST"
											action="?/redefinirSenha"
											use:enhance={submit(`reset-${u.id}`)}
										>
											<input type="hidden" name="userId" value={u.id} /><button
												class="btn btn-secondary">Nova senha</button
											>
										</form>
										<form
											method="POST"
											action="?/alternarAcesso"
											use:enhance={submit(`toggle-${u.id}`)}
										>
											<input type="hidden" name="userId" value={u.id} /><button
												class="btn btn-secondary">{u.active ? 'Desativar' : 'Reativar'}</button
											>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="muted">Nenhum login criado.</p>
			{/if}
		</section>

		<section class="card card-pad">
			<h2 class="section-title">Criar login</h2>
			<form method="POST" action="?/criarAcesso" class="form-grid" use:enhance={submit('criar')}>
				<div class="field">
					<label for="u-name">Nome</label><input id="u-name" name="name" required />
				</div>
				<div class="field">
					<label for="u-email">E-mail</label><input
						id="u-email"
						name="email"
						type="email"
						required
					/>
				</div>
				<div class="full">
					<button class="btn" disabled={busy === 'criar'}>Criar e gerar senha</button>
				</div>
			</form>
		</section>
	{/if}
</div>

<style>
	.small {
		font-size: 0.8rem;
	}

	.pw {
		display: inline-block;
		margin: 0 0.5rem;
		padding: 0.2rem 0.6rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		font-size: 1rem;
		user-select: all;
	}
</style>
