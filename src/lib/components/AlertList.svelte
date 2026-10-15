<script>
	/** @type {{ alerts: { id: string, severity: string, title: string, detail: string }[], empty?: string }} */
	let { alerts, empty = '' } = $props();

	const SEVERITY = { RED: 'danger', YELLOW: 'warn', GREEN: 'success' };
	const SEVERITY_TEXT = { RED: 'Atenção', YELLOW: 'Observar', GREEN: 'Oportunidade' };
</script>

{#if alerts.length}
	<ul class="alerts">
		{#each alerts as a (a.id)}
			<li class="card alert alert-{a.severity}">
				<span class="badge badge-{SEVERITY[a.severity]}">{SEVERITY_TEXT[a.severity]}</span>
				<div>
					<strong>{a.title}</strong>
					{#if a.detail}<p class="muted">{a.detail}</p>{/if}
				</div>
			</li>
		{/each}
	</ul>
{:else if empty}
	<p class="muted">{empty}</p>
{/if}

<style>
	.alerts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.alert {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		padding: 0.75rem 1rem;
	}

	.alert p {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
		line-height: 1.45;
	}

	.alert strong {
		font-size: 0.9rem;
	}

	.alert .badge {
		margin-top: 0.15rem;
		flex-shrink: 0;
		min-width: 6.4rem;
		justify-content: center;
	}
</style>
