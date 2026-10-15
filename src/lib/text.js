// Limpeza de texto gerado (IA ou modelo) pra seguir o padrão da marca.

/** Troca travessão e meia-risca por pontuação comum e tira espaços duplos. */
export function cleanText(text) {
	return String(text ?? '')
		.replace(/\s*—\s*/g, ', ')
		.replace(/\s*–\s*/g, ' a ')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

export function hasDash(text) {
	return /[—–]/.test(String(text ?? ''));
}
