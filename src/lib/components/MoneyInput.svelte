<script>
	import { toCents } from '$lib/money.js';

	/** Campo de valor em reais ligado a centavos (inteiro). */
	let { value = $bindable(0), id = undefined, label = '', hint = '' } = $props();

	// O texto nasce já formatado, assim o HTML do servidor vem preenchido.
	let text = $state(value ? (value / 100).toFixed(2).replace('.', ',') : '');

	function onInput(e) {
		text = e.currentTarget.value;
		const parsed = toCents(text);
		value = 'error' in parsed ? value : (parsed.value ?? 0);
	}
</script>

<div class="field">
	{#if label}<label for={id}>{label}</label>{/if}
	<input {id} inputmode="decimal" value={text} oninput={onInput} placeholder="0,00" />
	{#if hint}<span class="hint">{hint}</span>{/if}
</div>
