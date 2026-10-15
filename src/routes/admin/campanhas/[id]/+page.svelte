<script>
	import { enhance } from '$app/forms';
	import MoneyInput from '$lib/components/MoneyInput.svelte';
	import { brl } from '$lib/format.js';
	import { lintCopy } from '$lib/copyLint.js';
	import {
		CTAS,
		NEED_LABELS,
		OBJECTIVES,
		PLACEMENT_PRESETS,
		hasBlockingIssues,
		totalDailyBudgetCents,
		validateSpec
	} from '$lib/campaignSpec.js';

	let { data, form } = $props();

	// svelte-ignore state_referenced_locally
	let spec = $state(structuredClone(data.spec));
	let busy = $state('');
	let cityQuery = $state({});
	let cityResults = $state({});

	const editable = $derived(data.draft.editable);
	const objective = $derived(OBJECTIVES[data.draft.objective]);
	const ctaOptions = $derived(CTAS[data.draft.objective]);
	const assetIds = $derived(new Set(data.assets.map((a) => a.id)));
	const assetKinds = $derived(Object.fromEntries(data.assets.map((a) => [a.id, a.kind])));
	const issues = $derived(validateSpec(spec, data.account, { assetIds, assetKinds }));
	const blocked = $derived(hasBlockingIssues(issues));
	const total = $derived(totalDailyBudgetCents(spec));
	const state = $derived(data.draft.metaState);

	const STATUS = {
		DRAFT: 'rascunho',
		REVIEW: 'em revisão',
		UPLOADING: 'enviando',
		UPLOADED: 'na Meta, pausada',
		ACTIVE: 'ativa',
		FAILED: 'com falha'
	};

	function submit(name) {
		return () => {
			busy = name;
			return async ({ update }) => {
				await update({ reset: false });
				busy = '';
			};
		};
	}

	function addAdSet() {
		spec.adSets.push({
			name: `Conjunto ${spec.adSets.length + 1}`,
			dailyBudgetCents: 0,
			countries: ['BR'],
			cities: [],
			ageMin: 18,
			ageMax: 65,
			genders: 'all',
			advantageAudience: true,
			customAudienceIds: [],
			excludedAudienceIds: [],
			placement: 'automatic',
			ads: []
		});
	}

	function addAd(adSet) {
		const copy = data.copies[0];
		adSet.ads.push({
			name: `AD ${adSet.ads.length + 1}`,
			assetId: data.assets[0]?.id ?? '',
			primaryText: copy?.primaryText ?? '',
			headline: copy?.headline ?? '',
			description: copy?.description ?? '',
			cta: ctaOptions[0]
		});
	}

	function applyCopy(ad, copyId) {
		const c = data.copies.find((x) => x.id === copyId);
		if (!c) return;
		ad.primaryText = c.primaryText;
		ad.headline = c.headline;
		ad.description = c.description;
	}

	const ids = (text) =>
		text
			.split(/[\s,;]+/)
			.map((s) => s.trim())
			.filter(Boolean);

	async function searchCity(i, q) {
		cityQuery[i] = q;
		if (q.trim().length < 2) {
			cityResults[i] = [];
			return;
		}
		try {
			const res = await fetch(
				`/api/admin/cidades?q=${encodeURIComponent(q)}&conta=${data.account.id}`
			);
			const json = await res.json();
			cityResults[i] = Array.isArray(json) ? json : [];
		} catch {
			cityResults[i] = [];
		}
	}

	function addCity(adSet, i, city) {
		if (!adSet.cities.some((c) => c.key === city.key))
			adSet.cities.push({ key: city.key, name: city.name, radiusKm: 25 });
		cityQuery[i] = '';
		cityResults[i] = [];
	}

	const adsManagerUrl = $derived(
		data.draft.metaCampaignId
			? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${data.account.externalId.replace('act_', '')}&selected_campaign_ids=${data.draft.metaCampaignId}`
			: null
	);
</script>

<svelte:head>
	<title>{data.draft.name} · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>{data.draft.name}</h1>
			<p class="sub">
				{data.draft.clientName} · {data.account.name} · {objective.label} ·
				<span
					class="badge"
					class:badge-success={['UPLOADED', 'ACTIVE'].includes(data.draft.status)}
					class:badge-danger={data.draft.status === 'FAILED'}>{STATUS[data.draft.status]}</span
				>
			</p>
		</div>
		<a class="btn btn-secondary" href="/admin/campanhas">Voltar</a>
	</header>

	{#if form?.ok}<p class="success-text" role="status">{form.ok}</p>{/if}
	{#if form?.error}<p class="error-text" role="alert">{form.error}</p>{/if}
	{#if data.draft.lastError}<div class="notice danger">{data.draft.lastError}</div>{/if}

	{#if data.draft.plannerNotes}
		<section class="card card-pad">
			<h2 class="section-title">Por que o Claude propôs isso</h2>
			<p class="notes">{data.draft.plannerNotes}</p>
			<p class="muted small">É só uma proposta. Revise cada campo antes de enviar.</p>
		</section>
	{/if}

	{#if !editable}
		<div class="notice warn">
			Esta campanha já está na Meta, então a estrutura não é mais editável por aqui. Ajustes finos:
			Gerenciador de Anúncios ou pela fila de Ações.
		</div>
	{/if}

	<form method="POST" action="?/salvar" use:enhance={submit('salvar')}>
		<input type="hidden" name="spec" value={JSON.stringify($state.snapshot(spec))} />

		<fieldset disabled={!editable} class="plain">
			<section class="card card-pad stack">
				<h2 class="section-title">1. Campanha</h2>
				<div class="form-grid">
					<div class="field full">
						<label for="cname">Nome da campanha</label><input
							id="cname"
							bind:value={spec.campaignName}
						/>
					</div>
					<div class="field full">
						<label for="adv">Anunciante responsável (opcional)</label>
						<input id="adv" bind:value={spec.advertiserName} placeholder="Ex: Minha Marca" />
						<span class="hint"
							>Nome de quem anuncia e paga. Preencha se a Meta recusar com "forneça um anunciante
							verificado".</span
						>
					</div>
					<div class="field">
						<label for="mode">Onde fica o orçamento</label>
						<select id="mode" bind:value={spec.budgetMode}>
							<option value="ABO">Em cada conjunto (ABO)</option>
							<option value="CBO">Na campanha (CBO)</option>
						</select>
					</div>
					{#if spec.budgetMode === 'CBO'}
						<MoneyInput
							id="cbo"
							label="Orçamento diário da campanha (R$)"
							bind:value={spec.campaignDailyBudgetCents}
						/>
					{/if}
					{#each objective.needs as need (need)}
						<div class="field full">
							<label for={'dest-' + need}>{NEED_LABELS[need] ?? need}</label>
							<input
								id={'dest-' + need}
								bind:value={spec.destination[need]}
								placeholder={need === 'url' || need === 'storeUrl' ? 'https://' : ''}
							/>
							{#if need === 'leadFormId'}
								<span class="hint"
									>Copie do Gerenciador de Anúncios (Formulários) ou de um anúncio que já usa o
									formulário.</span
								>
							{:else if need === 'pixelId'}
								<span class="hint">Gerenciador de Eventos, Fontes de dados, Pixels.</span>
							{:else if need === 'postId'}
								<span class="hint"
									>No formato ID da página, underline, ID da publicação (menu da publicação, copiar
									ID).</span
								>
							{/if}
						</div>
					{/each}
					{#if ['whatsapp', 'messenger', 'instagram_dm'].includes(objective.creative)}
						<p class="muted full small">
							O botão abre a conversa ligada à página do Facebook. Confirme no Gerenciador de
							Anúncios que o canal (WhatsApp, Messenger ou Direct) está conectado à página.
						</p>
					{/if}
					{#if objective.experimental}
						<p class="muted full small">
							Objetivo em beta: rode "Validar na Meta" e confira a resposta antes de enviar.
						</p>
					{/if}
				</div>
			</section>

			{#each spec.adSets as adSet, i (i)}
				<section class="card card-pad stack">
					<div class="row between">
						<h2 class="section-title">2. Conjunto {i + 1}: público e orçamento</h2>
						{#if spec.adSets.length > 1}<button
								type="button"
								class="btn btn-secondary small"
								onclick={() => spec.adSets.splice(i, 1)}>Remover conjunto</button
							>{/if}
					</div>
					<div class="form-grid">
						<div class="field">
							<label for="sn{i}">Nome</label><input id="sn{i}" bind:value={adSet.name} />
						</div>
						{#if spec.budgetMode === 'ABO'}
							<MoneyInput
								id="sb{i}"
								label="Orçamento diário (R$)"
								bind:value={adSet.dailyBudgetCents}
							/>
						{/if}

						<div class="field full">
							<span class="lbl">Onde aparece</span>
							<label class="inline"
								><input
									type="checkbox"
									checked={adSet.countries.includes('BR')}
									onchange={(e) => (adSet.countries = e.currentTarget.checked ? ['BR'] : [])}
								/> Brasil inteiro</label
							>
							<input
								placeholder="Buscar cidade (ex: Uberlândia)"
								value={cityQuery[i] ?? ''}
								oninput={(e) => searchCity(i, e.currentTarget.value)}
							/>
							{#if (cityResults[i] ?? []).length}
								<ul class="results">
									{#each cityResults[i] as c (c.key)}
										<li>
											<button type="button" onclick={() => addCity(adSet, i, c)}>{c.name}</button>
										</li>
									{/each}
								</ul>
							{/if}
							{#each adSet.cities as c, ci (c.key)}
								<div class="row city">
									<span>{c.name}</span>
									<label class="inline"
										>raio <input
											class="mini"
											type="number"
											min="1"
											max="80"
											bind:value={c.radiusKm}
										/> km</label
									>
									<button
										type="button"
										class="btn-icon"
										aria-label="Remover cidade"
										onclick={() => adSet.cities.splice(ci, 1)}>×</button
									>
								</div>
							{/each}
						</div>

						<div class="field">
							<label for="amin{i}">Idade mínima</label><input
								id="amin{i}"
								type="number"
								min="18"
								max="65"
								bind:value={adSet.ageMin}
							/>
						</div>
						<div class="field">
							<label for="amax{i}">Idade máxima</label><input
								id="amax{i}"
								type="number"
								min="18"
								max="65"
								bind:value={adSet.ageMax}
							/>
						</div>
						<div class="field">
							<label for="g{i}">Gênero</label>
							<select id="g{i}" bind:value={adSet.genders}>
								<option value="all">Todos</option><option value="female">Mulheres</option><option
									value="male">Homens</option
								>
							</select>
						</div>
						<div class="field">
							<label for="pl{i}">Onde o anúncio roda</label>
							<select id="pl{i}" bind:value={adSet.placement}>
								{#each Object.entries(PLACEMENT_PRESETS) as [key, text] (key)}<option value={key}
										>{text}</option
									>{/each}
							</select>
						</div>
						<div class="field full">
							<label class="inline"
								><input type="checkbox" bind:checked={adSet.advantageAudience} /> Advantage+ audience
								(a Meta pode ampliar o público)</label
							>
							<span class="hint"
								>Com isto ligado, idade e gênero viram só sugestão. Desligue se o corte for
								exigência do cliente.</span
							>
						</div>
						<div class="field">
							<label for="ca{i}">Públicos personalizados (IDs)</label>
							<textarea
								id="ca{i}"
								rows="2"
								value={adSet.customAudienceIds.join(', ')}
								oninput={(e) => (adSet.customAudienceIds = ids(e.currentTarget.value))}></textarea>
						</div>
						<div class="field">
							<label for="ea{i}">Públicos excluídos (IDs)</label>
							<textarea
								id="ea{i}"
								rows="2"
								value={adSet.excludedAudienceIds.join(', ')}
								oninput={(e) => (adSet.excludedAudienceIds = ids(e.currentTarget.value))}
							></textarea>
						</div>
					</div>

					<h3 class="sub-title">Anúncios do conjunto</h3>
					{#each adSet.ads as ad, j (j)}
						{@const flags = lintCopy(ad)}
						<div class="card ad">
							<div class="row between">
								<strong>Anúncio {j + 1}</strong>
								<button
									type="button"
									class="btn btn-secondary small"
									onclick={() => adSet.ads.splice(j, 1)}>Remover</button
								>
							</div>
							<div class="form-grid">
								<div class="field">
									<label for="an{i}-{j}">Nome</label><input id="an{i}-{j}" bind:value={ad.name} />
								</div>
								<div class="field">
									<label for="as{i}-{j}">Criativo</label>
									<select id="as{i}-{j}" bind:value={ad.assetId}>
										<option value="">Escolha</option>
										{#each data.assets as a (a.id)}<option value={a.id}
												>{a.kind === 'IMAGE' ? 'Imagem' : 'Vídeo'}: {a.name}</option
											>{/each}
									</select>
								</div>
								{#if data.copies.length}
									<div class="field full">
										<label for="cp{i}-{j}">Usar uma copy aprovada</label>
										<select
											id="cp{i}-{j}"
											onchange={(e) => {
												applyCopy(ad, e.currentTarget.value);
												e.currentTarget.value = '';
											}}
										>
											<option value="">Escolha para preencher os textos</option>
											{#each data.copies as c (c.id)}<option value={c.id}
													>[{c.angle}] {c.headline}</option
												>{/each}
										</select>
									</div>
								{/if}
								<div class="field full">
									<label for="pt{i}-{j}">Texto principal</label><textarea
										id="pt{i}-{j}"
										rows="4"
										bind:value={ad.primaryText}></textarea>
								</div>
								<div class="field">
									<label for="hd{i}-{j}">Título ({ad.headline.length}/40)</label><input
										id="hd{i}-{j}"
										bind:value={ad.headline}
									/>
								</div>
								<div class="field">
									<label for="ds{i}-{j}">Descrição ({ad.description.length}/30)</label><input
										id="ds{i}-{j}"
										bind:value={ad.description}
									/>
								</div>
								<div class="field">
									<label for="ct{i}-{j}">Botão</label>
									<select id="ct{i}-{j}" bind:value={ad.cta}
										>{#each ctaOptions as c (c)}<option value={c}>{c}</option>{/each}</select
									>
								</div>
							</div>
							{#each flags as f, k (k)}<p class="flag" class:err={f.level === 'error'}>
									{f.level === 'error' ? 'Erro' : 'Atenção'}: {f.message}
								</p>{/each}
						</div>
					{/each}
					<div>
						<button type="button" class="btn btn-secondary" onclick={() => addAd(adSet)}
							>Adicionar anúncio</button
						>
					</div>
				</section>
			{/each}

			<div class="row">
				<button type="button" class="btn btn-secondary" onclick={addAdSet}
					>Adicionar conjunto</button
				>
			</div>
		</fieldset>

		<section class="card card-pad stack review">
			<h2 class="section-title">3. Revisão</h2>
			<p>
				Orçamento diário total quando ativada: <strong>{brl(total)}</strong
				>{#if data.account.maxDailyBudgetCents}
					<span class="muted">(teto da conta {brl(data.account.maxDailyBudgetCents)})</span>{/if}
			</p>
			{#if issues.length}
				<ul class="issues">
					{#each issues as it, k (k)}<li class:err={it.level === 'error'}>
							{it.level === 'error' ? 'Corrigir' : 'Atenção'}: {it.message}
						</li>{/each}
				</ul>
			{:else}
				<p class="success-text">Nada a corrigir.</p>
			{/if}
			{#if editable}
				<div class="row">
					<button class="btn" disabled={busy === 'salvar'}
						>{busy === 'salvar' ? 'Salvando...' : 'Salvar rascunho'}</button
					>
				</div>
			{/if}
		</section>
	</form>

	<section class="card card-pad stack">
		<h2 class="section-title">4. Enviar para a Meta</h2>
		<p class="muted">
			O envio cria tudo <strong>pausado</strong>. Nada gasta dinheiro até você ativar no passo 5.
		</p>
		<div class="row">
			<form method="POST" action="?/validarMeta" use:enhance={submit('validar')}>
				<button class="btn btn-secondary" disabled={busy === 'validar'}
					>{busy === 'validar' ? 'Validando...' : 'Validar na Meta (não cria nada)'}</button
				>
			</form>
			<form method="POST" action="?/enviar" use:enhance={submit('enviar')}>
				<button
					class="btn"
					disabled={blocked || busy === 'enviar' || data.draft.status === 'ACTIVE'}
					title={blocked ? 'Corrija os itens da revisão antes de enviar.' : ''}
				>
					{busy === 'enviar'
						? 'Enviando (vídeos podem levar minutos)...'
						: state?.campaignId
							? 'Reenviar o que falta'
							: 'Enviar pausada'}
				</button>
			</form>
		</div>
		{#if blocked}<p class="error-text small">
				Há itens para corrigir na revisão antes de enviar.
			</p>{/if}
		{#if form?.validation}
			<ul class="issues">
				{#each form.validation as v, k (k)}<li class:err={!v.ok}>{v.ad}: {v.message}</li>{/each}
			</ul>
		{/if}

		{#if state?.campaignId}
			<div class="state">
				<p>
					<strong>Na Meta:</strong> campanha <code>{state.campaignId}</code>{#if adsManagerUrl}
						· <a href={adsManagerUrl} target="_blank" rel="noopener noreferrer"
							>abrir no Gerenciador de Anúncios</a
						>{/if}
				</p>
				{#each state.adSets as s, i (i)}
					<p class="muted small">
						Conjunto {i + 1}: {s.id ?? 'não criado'} · anúncios criados {s.ads.filter(
							(a) => a?.adId
						).length} de {spec.adSets[i]?.ads.length ?? 0}
					</p>
				{/each}
				{#if state.errors?.length}
					<ul class="issues">
						{#each state.errors as e, k (k)}<li class="err">{e.ad}: {e.message}</li>{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</section>

	{#if data.draft.status === 'UPLOADED' || data.draft.status === 'ACTIVE'}
		<section class="card card-pad stack">
			<h2 class="section-title">5. Ativar</h2>
			{#if data.draft.status === 'UPLOADED'}
				<form method="POST" action="?/ativar" use:enhance={submit('ativar')} class="stack">
					<label class="inline">
						<input type="checkbox" name="confirm" />
						Confirmo que esta campanha começa a gastar até <strong>{brl(total)} por dia</strong> na
						conta {data.account.name}.
					</label>
					<div>
						<button class="btn btn-danger" disabled={busy === 'ativar'}
							>{busy === 'ativar' ? 'Ativando...' : 'Ativar campanha'}</button
						>
					</div>
				</form>
			{:else}
				<p class="success-text">Campanha ativa.</p>
				<form method="POST" action="?/pausar" use:enhance={submit('pausar')}>
					<button class="btn btn-secondary" disabled={busy === 'pausar'}>Pausar campanha</button>
				</form>
			{/if}
		</section>
	{/if}

	{#if !data.draft.metaCampaignId}
		<form method="POST" action="?/excluir" use:enhance class="no-print">
			<button class="btn btn-danger">Excluir rascunho</button>
		</form>
	{/if}
</div>

<style>
	fieldset.plain {
		border: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 1.25rem;
		min-width: 0;
	}

	form + section,
	form {
		margin: 0;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.between {
		justify-content: space-between;
	}

	.small {
		font-size: 0.78rem;
	}

	button.small {
		padding: 0.35rem 0.7rem;
	}

	.notes {
		margin: 0 0 0.5rem;
		line-height: 1.55;
		white-space: pre-line;
	}

	.sub-title {
		margin: 0.5rem 0 0;
		font-size: 0.9rem;
	}

	.ad {
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.lbl {
		font-size: 0.85rem;
		color: var(--color-text-dim);
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.88rem;
		color: var(--color-text);
	}

	.inline input[type='checkbox'] {
		width: auto;
	}

	.mini {
		width: 4.5rem;
	}

	.city {
		justify-content: space-between;
		padding: 0.35rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.results {
		list-style: none;
		margin: 0.3rem 0 0;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-button);
		overflow: hidden;
	}

	.results button {
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.7rem;
		background: var(--color-bg);
		color: var(--color-text);
		border: none;
		cursor: pointer;
	}

	.results button:hover {
		background: var(--color-bg-elevated);
	}

	.issues {
		margin: 0;
		padding-left: 1.1rem;
		font-size: 0.85rem;
		line-height: 1.55;
		color: var(--color-accent);
	}

	.issues li.err,
	.flag.err {
		color: var(--color-danger);
	}

	.flag {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-accent);
	}

	.state code {
		font-size: 0.8rem;
	}

	.state p {
		margin: 0.2rem 0;
	}
</style>
