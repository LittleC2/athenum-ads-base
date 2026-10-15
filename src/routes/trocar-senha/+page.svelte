<script>
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Nova senha · Athenum Ads</title>
</svelte:head>

<main class="wrap">
	<form class="card box" method="POST" use:enhance>
		<h1>Crie sua senha</h1>
		<p class="muted">Por segurança, troque a senha temporária por uma só sua.</p>

		<div class="field">
			<label for="password">Nova senha</label>
			<input
				id="password"
				name="password"
				type="password"
				minlength="8"
				autocomplete="new-password"
				required
			/>
			<span class="hint">Mínimo de 8 caracteres.</span>
		</div>
		<div class="field">
			<label for="confirm">Repita a nova senha</label>
			<input
				id="confirm"
				name="confirm"
				type="password"
				minlength="8"
				autocomplete="new-password"
				required
			/>
		</div>

		{#if form?.error}<p class="error-text" role="alert">{form.error}</p>{/if}
		<button class="btn" type="submit">Salvar e entrar</button>
	</form>
</main>

<style>
	.wrap {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.box {
		width: 100%;
		max-width: 380px;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.3rem;
		text-transform: uppercase;
		letter-spacing: -0.02em;
		font-weight: 800;
	}

	p {
		margin: 0;
		font-size: 0.9rem;
	}
</style>
