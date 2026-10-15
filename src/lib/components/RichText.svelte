<script>
	/**
	 * Renderiza texto simples com parágrafos, listas (- ou 1.), subtítulos (##)
	 * e **negrito**, sem usar {@html}: o texto vem de IA, então nunca vira HTML.
	 */
	let { text = '' } = $props();

	function inline(line) {
		return line
			.split(/(\*\*[^*]+\*\*)/g)
			.filter(Boolean)
			.map((part) =>
				part.startsWith('**') && part.endsWith('**')
					? { bold: true, text: part.slice(2, -2) }
					: { bold: false, text: part }
			);
	}

	const blocks = $derived.by(() => {
		const out = [];
		let list = null;
		for (const raw of String(text).split('\n')) {
			const line = raw.trim();
			if (!line) {
				list = null;
				continue;
			}
			const bullet = line.match(/^[-*]\s+(.*)/);
			const numbered = line.match(/^\d+[.)]\s+(.*)/);
			if (bullet || numbered) {
				const kind = bullet ? 'ul' : 'ol';
				if (!list || list.kind !== kind) {
					list = { kind, items: [] };
					out.push(list);
				}
				list.items.push(inline((bullet ?? numbered)[1]));
				continue;
			}
			list = null;
			const heading = line.match(/^#{1,4}\s+(.*)/);
			out.push(
				heading ? { kind: 'h', parts: inline(heading[1]) } : { kind: 'p', parts: inline(line) }
			);
		}
		return out;
	});
</script>

<div class="prose">
	{#each blocks as b, i (i)}
		{#if b.kind === 'h'}
			<h3>
				{#each b.parts as p, j (j)}{#if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}{/each}
			</h3>
		{:else if b.kind === 'p'}
			<p>
				{#each b.parts as p, j (j)}{#if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}{/each}
			</p>
		{:else if b.kind === 'ul'}
			<ul>
				{#each b.items as item, k (k)}
					<li>
						{#each item as p, j (j)}{#if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}{/each}
					</li>
				{/each}
			</ul>
		{:else}
			<ol>
				{#each b.items as item, k (k)}
					<li>
						{#each item as p, j (j)}{#if p.bold}<strong>{p.text}</strong>{:else}{p.text}{/if}{/each}
					</li>
				{/each}
			</ol>
		{/if}
	{/each}
</div>
