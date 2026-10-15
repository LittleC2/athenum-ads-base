// Traduz erros conhecidos da Meta em instrução do que fazer. Módulo puro.
// Os dois primeiros foram vistos de verdade ao validar a conta de clientes.

const HINTS = [
	[
		/modo de desenvolvimento|development mode/i,
		'Ação necessária: no Meta for Developers, coloque o app Athenum em modo "Ao vivo" (Configurações do app, Básico). Em desenvolvimento a Meta recusa criar anúncios por API.'
	],
	[
		/Termos de Serviço de Geração de Cadastros|Lead Gen(eration)? Terms/i,
		'Ação necessária: a Página do Facebook precisa aceitar os Termos de Serviço de Geração de Cadastros (aceite ao criar um formulário de cadastro na Página).'
	],
	[
		/capa do vídeo|image_hash ou image_url/i,
		'O vídeo ainda não tem capa na Meta. Aguarde o processamento e reenvie.'
	],
	[
		/permission|permiss[aã]o/i,
		'O token não tem permissão para esta conta ou página. Confira o acesso de parceiro na BM e as permissões do token em Ajustes.'
	]
];

/** @param {{ message?: string, userMessage?: string|null }} err */
export function explainMetaError(err) {
	const base = String(err.userMessage || err.message || 'Erro desconhecido');
	const hint = HINTS.find(([re]) => re.test(base) || re.test(String(err.message ?? '')))?.[1];
	return (hint ? `${base} ${hint}` : base).slice(0, 600);
}
