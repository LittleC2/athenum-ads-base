<script>
	import { enhance } from '$app/forms';

	let { form } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Entrar · Athenum Ads</title>
</svelte:head>

<main class="login-screen">
	<form
		class="card login-card"
		method="POST"
		use:enhance={() => {
			loading = true;
			return async ({ update }) => {
				await update();
				loading = false;
			};
		}}
	>
		<div class="brand">
			<span class="brand-mark">A</span>
			<h1>Athenum Ads</h1>
		</div>
		<p class="subtitle">Acompanhe o resultado dos seus anúncios.</p>

		<div class="field">
			<label for="email">E-mail</label>
			<input id="email" name="email" type="email" autocomplete="email" required />
		</div>

		<div class="field">
			<label for="password">Senha</label>
			<input
				id="password"
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/>
		</div>

		{#if form?.error}
			<p class="error-text" role="alert">{form.error}</p>
		{/if}

		<button class="btn" type="submit" disabled={loading}>
			{loading ? 'Entrando...' : 'Entrar'}
		</button>
	</form>
</main>

<style>
	.login-screen {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.login-card {
		width: 100%;
		max-width: 380px;
		padding: 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
	}

	.brand-mark {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-button);
		background: var(--color-accent);
		color: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
	}

	h1 {
		margin: 0;
		font-size: 1.4rem;
		text-transform: uppercase;
		letter-spacing: -0.02em;
		font-weight: 800;
	}

	.subtitle {
		margin: 0;
		color: var(--color-text-dim);
		font-size: 0.9rem;
	}
</style>
