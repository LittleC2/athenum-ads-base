// Nunca deixar um token da Meta ou da Anthropic aparecer em mensagem de erro, log ou tela.
const TOKEN_LIKE = [/EAA[A-Za-z0-9]{20,}/g, /sk-ant-[A-Za-z0-9_-]{20,}/g];

export function redactSecrets(text) {
	let out = String(text ?? '');
	for (const re of TOKEN_LIKE) out = out.replace(re, '[token oculto]');
	return out;
}

/** Valor de variável de token limpo: só a primeira palavra (colar com quebra de linha é comum). */
export function cleanToken(value) {
	return String(value ?? '')
		.trim()
		.split(/\s+/)[0];
}
