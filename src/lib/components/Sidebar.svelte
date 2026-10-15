<script>
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { afterNavigate } from '$app/navigation';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Users from '@lucide/svelte/icons/users';
	import Bell from '@lucide/svelte/icons/bell';
	import FileText from '@lucide/svelte/icons/file-text';
	import Megaphone from '@lucide/svelte/icons/megaphone';
	import Library from '@lucide/svelte/icons/library';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Settings from '@lucide/svelte/icons/settings';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import ThemeToggle from './ThemeToggle.svelte';
	import { HIDDEN_LINKS_IN_DASHBOARD_ONLY } from '$lib/dashboardOnly.js';

	let { role, clientName = null, dashboardOnly = false } = $props();

	const ADMIN_LINKS = [
		{ href: '/admin', label: 'Visão geral', icon: LayoutDashboard },
		{ href: '/admin/clientes', label: 'Clientes', icon: Users },
		{ href: '/admin/campanhas', label: 'Campanhas', icon: Megaphone },
		{ href: '/admin/acoes', label: 'Ações', icon: ListChecks },
		{ href: '/admin/alertas', label: 'Alertas', icon: Bell },
		{ href: '/admin/relatorios', label: 'Relatórios', icon: FileText },
		{ href: '/admin/biblioteca', label: 'Biblioteca', icon: Library },
		{ href: '/admin/ajustes', label: 'Ajustes', icon: Settings }
	];

	const CLIENT_LINKS = [
		{ href: '/painel', label: 'Painel', icon: TrendingUp },
		{ href: '/painel/relatorios', label: 'Relatórios', icon: FileText },
		{ href: '/painel/resultados', label: 'Resultados', icon: ClipboardCheck }
	];

	const links = $derived(
		role === 'ADMIN'
			? ADMIN_LINKS.filter(
					(l) => !(dashboardOnly && HIDDEN_LINKS_IN_DASHBOARD_ONLY.includes(l.href))
				)
			: CLIENT_LINKS
	);
	const home = $derived(role === 'ADMIN' ? '/admin' : '/painel');

	// No celular: os 4 primeiros ficam na barra, o resto vai pro "Mais".
	const MOBILE_MAIN = 4;
	const mainLinks = $derived(links.length > MOBILE_MAIN ? links.slice(0, MOBILE_MAIN - 1) : links);
	const moreLinks = $derived(links.length > MOBILE_MAIN ? links.slice(MOBILE_MAIN - 1) : []);
	let moreOpen = $state(false);
	const moreActive = $derived(moreLinks.some((l) => isActive(l.href)));

	function isActive(href) {
		return page.url.pathname === href || (href !== home && page.url.pathname.startsWith(href));
	}

	afterNavigate(() => {
		moreOpen = false;
	});
</script>

<aside class="sidebar">
	<a href={resolve(home)} class="brand">
		<span class="brand-mark">A</span>
		<span class="brand-name">
			Athenum Ads
			{#if role === 'CLIENT' && clientName}<small>{clientName}</small>{/if}
		</span>
	</a>

	<nav class="links" aria-label="Principal">
		{#each links as link (link.href)}
			<a
				href={resolve(link.href)}
				class="link"
				class:active={isActive(link.href)}
				aria-current={isActive(link.href) ? 'page' : undefined}
			>
				<link.icon size={18} strokeWidth={2} />
				<span>{link.label}</span>
			</a>
		{/each}
	</nav>

	<div class="foot">
		<ThemeToggle />
	</div>

	<form method="POST" action={resolve('/logout')} class="logout">
		<button class="link" type="submit">
			<LogOut size={18} strokeWidth={2} />
			<span>Sair</span>
		</button>
	</form>
</aside>

<!-- Celular: barra inferior fixa com os atalhos principais e o "Mais" -->
<nav class="mobilebar" aria-label="Principal">
	{#each mainLinks as link (link.href)}
		<a
			href={resolve(link.href)}
			class="tab"
			class:active={isActive(link.href)}
			aria-current={isActive(link.href) ? 'page' : undefined}
		>
			<link.icon size={20} strokeWidth={2} />
			<span>{link.label}</span>
		</a>
	{/each}
	<button
		type="button"
		class="tab"
		class:active={moreOpen || moreActive}
		aria-expanded={moreOpen}
		onclick={() => (moreOpen = !moreOpen)}
	>
		<Ellipsis size={20} strokeWidth={2} />
		<span>Mais</span>
	</button>
</nav>

{#if moreOpen}
	<button class="scrim" type="button" aria-label="Fechar o menu" onclick={() => (moreOpen = false)}
	></button>
	<div class="sheet" role="dialog" aria-label="Mais opções">
		{#each moreLinks as link (link.href)}
			<a
				href={resolve(link.href)}
				class="sheet-link"
				class:active={isActive(link.href)}
				aria-current={isActive(link.href) ? 'page' : undefined}
			>
				<link.icon size={20} strokeWidth={2} />
				<span>{link.label}</span>
			</a>
		{/each}
		<div class="sheet-row"><ThemeToggle /></div>
		<form method="POST" action={resolve('/logout')} class="sheet-row">
			<button class="sheet-link" type="submit">
				<LogOut size={20} strokeWidth={2} />
				<span>Sair</span>
			</button>
		</form>
	</div>
{/if}

<style>
	/* Desktop */
	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		height: 100%;
		padding: 1.25rem 0.9rem;
		border-right: 1px solid var(--color-border);
		background: var(--color-bg-alt);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		text-decoration: none;
		padding: 0 0.4rem;
	}

	.brand-mark {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-button);
		background: var(--color-accent);
		color: #000;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		flex-shrink: 0;
	}

	.brand-name {
		display: flex;
		flex-direction: column;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: -0.02em;
		font-size: 0.85rem;
		line-height: 1.15;
	}

	.brand-name small {
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
		color: var(--color-text-dim);
		font-size: 0.72rem;
	}

	.links {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		flex: 1;
	}

	.link {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.55rem 0.6rem;
		border-radius: var(--radius-button);
		text-decoration: none;
		color: var(--color-text-dim);
		font-size: 0.85rem;
		font-weight: 600;
		border: none;
		background: transparent;
		cursor: pointer;
		width: 100%;
		text-align: left;
		font-family: inherit;
		transition:
			background-color var(--transition-fast),
			color var(--transition-fast);
	}

	/* O ícone nunca encolhe nem desce: todos alinhados na mesma coluna. */
	.link :global(svg) {
		flex-shrink: 0;
	}

	.link:hover {
		background: var(--color-bg-elevated);
		color: var(--color-text);
	}

	.link.active {
		background: var(--color-bg-elevated);
		color: var(--color-accent);
	}

	.foot {
		display: flex;
	}

	.logout {
		border-top: 1px solid var(--color-border);
		padding-top: 0.75rem;
	}

	/* Celular */
	.mobilebar,
	.sheet,
	.scrim {
		display: none;
	}

	@media (max-width: 860px) {
		.sidebar {
			display: none;
		}

		.mobilebar {
			display: grid;
			grid-auto-flow: column;
			grid-auto-columns: 1fr;
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 30;
			padding: 0.35rem 0.25rem calc(0.35rem + env(safe-area-inset-bottom));
			background: var(--color-bg-alt);
			border-top: 1px solid var(--color-border);
		}

		.tab {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.2rem;
			min-height: 3.1rem;
			padding: 0.3rem 0.15rem;
			border: none;
			border-radius: var(--radius-button);
			background: transparent;
			color: var(--color-text-dim);
			font-family: inherit;
			font-size: 0.66rem;
			font-weight: 600;
			line-height: 1.1;
			text-decoration: none;
			text-align: center;
			cursor: pointer;
		}

		.tab span {
			max-width: 100%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.tab.active {
			color: var(--color-accent);
			background: var(--color-accent-dim);
		}

		.scrim {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 31;
			border: none;
			background: rgba(0, 0, 0, 0.55);
		}

		.sheet {
			display: flex;
			flex-direction: column;
			position: fixed;
			left: 0.5rem;
			right: 0.5rem;
			bottom: calc(4.4rem + env(safe-area-inset-bottom));
			z-index: 32;
			padding: 0.4rem;
			border-radius: 14px;
			border: 1px solid var(--color-border);
			background: var(--color-bg-alt);
			box-shadow: var(--shadow-md);
		}

		.sheet-link {
			display: flex;
			align-items: center;
			gap: 0.8rem;
			min-height: 3rem;
			padding: 0 0.8rem;
			border: none;
			border-radius: 10px;
			background: transparent;
			color: var(--color-text);
			font-family: inherit;
			font-size: 0.92rem;
			font-weight: 600;
			text-decoration: none;
			cursor: pointer;
			width: 100%;
			text-align: left;
		}

		.sheet-link.active {
			color: var(--color-accent);
			background: var(--color-accent-dim);
		}

		.sheet-row {
			margin: 0;
			border-top: 1px solid var(--color-border);
			padding-top: 0.25rem;
			margin-top: 0.25rem;
		}
	}
</style>
