<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let busy = $state('');
	let editing = $state('');

	const mb = (n) => `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
	const STATUS = {
		SUGGESTED: ['sugerida', ''],
		APPROVED: ['aprovada', 'success'],
		REJECTED: ['rejeitada', 'danger']
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
</script>

<svelte:head>
	<title>Biblioteca · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Biblioteca</h1>
			<p class="sub">Criativos e copys de cada cliente, prontos para montar campanha.</p>
		</div>
		<div class="chips">
			{#each data.clients as c (c.id)}
				<a class="chip" class:active={c.id === data.clientId} href="?cliente={c.id}">{c.name}</a>
			{/each}
		</div>
	</header>

	{#if form?.ok && typeof form.ok === 'string'}<p class="success-text" role="status">
			{form.ok}
		</p>{/if}
	{#if form?.error}<p class="error-text" role="alert">{form.error}</p>{/if}

	{#if data.clientId}
		<section class="card card-pad">
			<h2 class="section-title">Criativos</h2>
			<form
				method="POST"
				action="?/subir"
				enctype="multipart/form-data"
				class="row no-print"
				use:enhance={submit('subir')}
			>
				<input type="hidden" name="clientId" value={data.clientId} />
				<input
					type="file"
					name="files"
					multiple
					accept="image/jpeg,image/png,video/mp4,video/quicktime"
					required
				/>
				<button class="btn" disabled={busy === 'subir'}
					>{busy === 'subir' ? 'Enviando...' : 'Enviar criativos'}</button
				>
			</form>
			<div class="assets">
				{#each data.assets as a (a.id)}
					<figure class="card asset">
						{#if a.kind === 'IMAGE'}
							<img src="/api/admin/asset/{a.id}" alt={a.name} loading="lazy" />
						{:else}
							<video src="/api/admin/asset/{a.id}" preload="metadata" muted></video>
						{/if}
						<figcaption>
							<strong>{a.name}</strong>
							<span class="muted"
								>{a.kind === 'IMAGE' ? 'imagem' : 'vídeo'} · {mb(a.sizeBytes)}{#if a.onMeta}
									· já na Meta{/if}</span
							>
							<form method="POST" action="?/excluirAsset" use:enhance={submit(`del-${a.id}`)}>
								<input type="hidden" name="id" value={a.id} />
								<button class="btn btn-secondary small">Remover</button>
							</form>
						</figcaption>
					</figure>
				{:else}
					<p class="muted">Nenhum criativo enviado para este cliente.</p>
				{/each}
			</div>
		</section>

		<section class="card card-pad">
			<h2 class="section-title">Laboratório de copys</h2>
			{#if data.withAI}
				<form method="POST" action="?/gerarCopys" class="form-grid" use:enhance={submit('gerar')}>
					<input type="hidden" name="clientId" value={data.clientId} />
					<div class="field">
						<label for="obj">Objetivo da campanha</label>
						<select id="obj" name="objective">
							{#each data.objectiveGroups as g (g.group)}
								<optgroup label={g.label}>
									{#each g.items as o (o.key)}<option value={o.key}>{o.label}</option>{/each}
								</optgroup>
							{/each}
						</select>
					</div>
					<div class="field">
						<label for="count">Quantas variantes</label>
						<input id="count" name="count" type="number" min="1" max="10" value="5" />
					</div>
					<div class="field full">
						<label for="angles">Ângulos (opcional)</label>
						<input
							id="angles"
							name="angles"
							placeholder="Ex: dor de perder paciente, prova, objeção de preço"
						/>
					</div>
					<div class="field full">
						<label for="ins">Instruções extras (opcional)</label>
						<textarea id="ins" name="instructions" rows="2"></textarea>
					</div>
					<div class="full">
						<button class="btn" disabled={busy === 'gerar'}
							>{busy === 'gerar' ? 'O Claude está escrevendo...' : 'Gerar com o Claude'}</button
						>
					</div>
				</form>
			{:else}
				<p class="muted">
					<span class="badge badge-warn">sem ANTHROPIC_API_KEY</span> A geração por IA fica disponível
					quando a chave estiver configurada. Você já pode escrever copys à mão abaixo.
				</p>
			{/if}

			<details class="manual">
				<summary>Escrever uma copy à mão</summary>
				<form
					method="POST"
					action="?/adicionarCopy"
					class="form-grid"
					use:enhance={submit('manual')}
				>
					<input type="hidden" name="clientId" value={data.clientId} />
					<div class="field full">
						<label for="m-angle">Ângulo</label><input id="m-angle" name="angle" />
					</div>
					<div class="field full">
						<label for="m-text">Texto principal</label><textarea
							id="m-text"
							name="primaryText"
							rows="3"
							required></textarea>
					</div>
					<div class="field">
						<label for="m-head">Título</label><input id="m-head" name="headline" required />
					</div>
					<div class="field">
						<label for="m-desc">Descrição</label><input id="m-desc" name="description" />
					</div>
					<div class="full">
						<button class="btn btn-secondary" disabled={busy === 'manual'}
							>Adicionar e aprovar</button
						>
					</div>
				</form>
			</details>

			<div class="copies">
				{#each data.copies as c (c.id)}
					{@const [text, variant] = STATUS[c.status]}
					<article class="card copy">
						<div class="row">
							<span
								class="badge"
								class:badge-success={variant === 'success'}
								class:badge-danger={variant === 'danger'}>{text}</span
							>
							<span class="muted small">{c.angle} · {c.source}</span>
						</div>
						{#if editing === c.id}
							<form
								method="POST"
								action="?/salvarCopy"
								class="form-grid"
								use:enhance={() =>
									async ({ update }) => {
										await update({ reset: false });
										editing = '';
									}}
							>
								<input type="hidden" name="id" value={c.id} />
								<div class="field full">
									<textarea name="primaryText" rows="4">{c.primaryText}</textarea>
								</div>
								<div class="field"><input name="headline" value={c.headline} /></div>
								<div class="field"><input name="description" value={c.description} /></div>
								<div class="full row">
									<button class="btn">Salvar</button><button
										type="button"
										class="btn btn-secondary"
										onclick={() => (editing = '')}>Cancelar</button
									>
								</div>
							</form>
						{:else}
							<p class="text">{c.primaryText}</p>
							<p>
								<strong>{c.headline}</strong>{#if c.description}
									<span class="muted">· {c.description}</span>{/if}
							</p>
						{/if}
						{#each c.lintFlags as f, i (i)}
							<p class="flag" class:err={f.level === 'error'}>
								{f.level === 'error' ? 'Erro' : 'Atenção'}: {f.message}
							</p>
						{/each}
						<div class="row no-print">
							{#if c.status !== 'APPROVED'}
								<form method="POST" action="?/statusCopy" use:enhance>
									<input type="hidden" name="id" value={c.id} /><input
										type="hidden"
										name="status"
										value="APPROVED"
									/><button class="btn btn-secondary small">Aprovar</button>
								</form>
							{/if}
							{#if c.status !== 'REJECTED'}
								<form method="POST" action="?/statusCopy" use:enhance>
									<input type="hidden" name="id" value={c.id} /><input
										type="hidden"
										name="status"
										value="REJECTED"
									/><button class="btn btn-secondary small">Rejeitar</button>
								</form>
							{/if}
							<button type="button" class="btn btn-secondary small" onclick={() => (editing = c.id)}
								>Editar</button
							>
							<form method="POST" action="?/excluirCopy" use:enhance>
								<input type="hidden" name="id" value={c.id} /><button
									class="btn btn-secondary small">Excluir</button
								>
							</form>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{:else}
		<p class="muted">Cadastre um cliente primeiro.</p>
	{/if}
</div>

<style>
	.assets {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.asset {
		margin: 0;
		overflow: hidden;
	}

	.asset img,
	.asset video {
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		display: block;
		background: var(--color-bg);
	}

	.asset figcaption {
		padding: 0.6rem 0.7rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
	}

	.small {
		font-size: 0.75rem;
		padding: 0.35rem 0.7rem;
	}

	.manual {
		margin: 1rem 0;
	}

	.copies {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.copy {
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.copy p {
		margin: 0;
	}

	.text {
		white-space: pre-line;
		line-height: 1.5;
	}

	.flag {
		font-size: 0.8rem;
		color: var(--color-accent);
	}

	.flag.err {
		color: var(--color-danger);
	}
</style>
