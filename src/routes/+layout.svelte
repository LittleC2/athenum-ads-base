<script>
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import CopilotWidget from '$lib/components/CopilotWidget.svelte';

	let { data, children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#000000" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

{#if data.user}
	<div class="app-shell">
		<div class="sidebar-wrap">
			<Sidebar
				role={data.user.role}
				clientName={data.user.clientName}
				dashboardOnly={data.dashboardOnly}
			/>
		</div>
		<div class="content">
			{@render children()}
		</div>
	</div>
	{#if data.user.role === 'ADMIN' && !data.dashboardOnly}
		<CopilotWidget />
	{/if}
{:else}
	{@render children()}
{/if}

<style>
	.sidebar-wrap {
		min-height: 100%;
	}
</style>
