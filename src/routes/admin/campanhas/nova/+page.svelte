<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let busy = $state(false);
	// svelte-ignore state_referenced_locally
	let useAI = $state(data.withAI);
</script>

<svelte:head>
	<title>Nova campanha · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Nova campanha</h1>
			<p class="sub">
				Escolha a conta e o objetivo. O Claude pode propor a estrutura; você revisa tudo antes de
				enviar.
			</p>
		</div>
	</header>

	<form
		class="card card-pad form-grid"
		method="POST"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<div class="field">
			<label for="acc">Conta do cliente</label>
			<select id="acc" name="accountId" required>
				{#each data.accounts as a (a.id)}
					<option value={a.id} selected={a.clientId === data.preferredClient}
						>{a.clientName} · {a.name}</option
					>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="obj">Objetivo</label>
			<select id="obj" name="objective" required>
				{#each data.objectiveGroups as g (g.group)}
					<optgroup label={g.label}>
						{#each g.items as o (o.key)}<option value={o.key}
								>{o.label}{o.experimental ? ' (beta)' : ''}</option
							>{/each}
					</optgroup>
				{/each}
			</select>
		</div>
		<div class="field full">
			<label for="name">Nome da campanha</label>
			<input id="name" name="name" placeholder="Ex: ATH - CAMPANHA [LEADS] [WPP] v2" required />
		</div>

		<div class="field full">
			<label>
				<input type="checkbox" name="useAI" bind:checked={useAI} disabled={!data.withAI} />
				Pedir ao Claude para propor a estrutura (conjuntos, público, orçamento e anúncios)
			</label>
			{#if !data.withAI}<span class="hint"
					>Indisponível: falta ANTHROPIC_API_KEY. A campanha começa em branco.</span
				>{/if}
		</div>
		{#if useAI && data.withAI}
			<div class="field full">
				<label for="ins">Instruções para o Claude (opcional)</label>
				<textarea
					id="ins"
					name="instructions"
					rows="3"
					placeholder="Ex: usar os dois vídeos novos, orçamento de R$ 40 por dia, só mulheres de 25 a 54 em Uberlândia"
				></textarea>
			</div>
		{/if}

		{#if form?.error}<p class="error-text full" role="alert">{form.error}</p>{/if}
		<div class="full row">
			<button class="btn" disabled={busy}>{busy ? 'Montando...' : 'Criar rascunho'}</button>
			<a class="btn btn-secondary" href="/admin/campanhas">Cancelar</a>
		</div>
	</form>
</div>
