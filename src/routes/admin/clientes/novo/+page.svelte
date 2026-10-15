<script>
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Novo cliente · Athenum Ads</title>
</svelte:head>

<div class="page">
	<header class="page-header">
		<div>
			<h1>Novo cliente</h1>
			<p class="sub">Depois de criar, vincule a conta de anúncios e gere o acesso ao portal.</p>
		</div>
	</header>

	<form class="card card-pad form-grid" method="POST" use:enhance>
		<div class="field">
			<label for="name">Nome</label>
			<input id="name" name="name" value={form?.name ?? ''} required />
		</div>
		<div class="field">
			<label for="segment">Segmento</label>
			<input
				id="segment"
				name="segment"
				value={form?.segment ?? ''}
				placeholder="Ex: Saúde e estética"
			/>
		</div>
		{#if form?.error}<p class="error-text full" role="alert">{form.error}</p>{/if}
		<div class="full row">
			<button class="btn" type="submit">Criar cliente</button>
			<a class="btn btn-secondary" href="/admin/clientes">Cancelar</a>
		</div>
	</form>
</div>
