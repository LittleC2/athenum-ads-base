// Conversão de campos de formulário (texto) em números. Módulo puro.

/** 'R$ 1.234,56' | '1234.56' | '1234' -> { value: 123456 }; vazio -> { value: null }; inválido -> { error: true } */
export function toCents(input) {
	const s = String(input ?? '').trim();
	if (s === '') return { value: null };
	const normalized = s
		.replace(/[R$\s]/g, '')
		.replace(/\.(?=\d{3}(\D|$))/g, '')
		.replace(',', '.');
	if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return { error: true };
	return { value: Math.round(Number(normalized) * 100) };
}

/** Inteiro não negativo opcional. */
export function optionalInt(input, { max = 10_000_000 } = {}) {
	const s = String(input ?? '').trim();
	if (s === '') return { value: null };
	if (!/^\d+$/.test(s)) return { error: true };
	const n = Number(s);
	return n > max ? { error: true } : { value: n };
}

/** Decimal opcional (ex: taxa de fechamento 12,5). */
export function optionalFloat(input, { min = 0, max = 100 } = {}) {
	const s = String(input ?? '')
		.trim()
		.replace(',', '.');
	if (s === '') return { value: null };
	if (!/^\d+(\.\d+)?$/.test(s)) return { error: true };
	const n = Number(s);
	return n < min || n > max ? { error: true } : { value: n };
}
