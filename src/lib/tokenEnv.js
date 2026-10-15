// Nome da variável de ambiente que guarda o token da Meta de um cliente.
// O valor do token nunca vai pro banco: só o nome da variável. Restringir o
// formato impede que um nome digitado por engano leia outro segredo do servidor.

const PATTERN = /^META_TOKEN_[A-Z0-9_]{1,40}$/;

export function isValidTokenEnv(name) {
	return PATTERN.test(String(name ?? ''));
}

/** 'clinica-exemplo' -> 'META_TOKEN_CLINICA_EXEMPLO' */
export function suggestTokenEnv(slug) {
	const body = String(slug)
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 40);
	return `META_TOKEN_${body || 'CLIENTE'}`;
}
