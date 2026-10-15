// Prova que cada conta usa o token da SUA variável (META_TOKEN_*) e não o geral.
// Usa o token geral copiado pra uma variável de teste e um token inválido.
// Uso: npx vite-node --config vitest.config.js scripts/token-env-test.js
process.env.META_TOKEN_ZZ_BOM = process.env.META_ADS_ACCESS_TOKEN;
process.env.META_TOKEN_ZZ_RUIM = 'token-invalido-de-teste';
delete process.env.META_TOKEN_ZZ_AUSENTE;

const { graph, withAccountToken } = await import('../src/lib/server/meta/client.js');
const { getTokenHealth } = await import('../src/lib/server/meta/token.js');

const results = [];
const check = (name, ok, extra = '') => {
	results.push(ok);
	console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${extra ? ' | ' + extra : ''}`);
};
const run = (tokenEnv) =>
	withAccountToken({ tokenEnv }, () => graph('me', { params: { fields: 'id' } }));
const fails = async (tokenEnv) =>
	run(tokenEnv).then(
		() => null,
		(e) => e
	);

check('sem tokenEnv usa o token geral', Boolean((await run(null)).id));
check('tokenEnv com token bom funciona', Boolean((await run('META_TOKEN_ZZ_BOM')).id));
const bad = await fails('META_TOKEN_ZZ_RUIM');
check(
	'tokenEnv com token inválido é recusado pela Meta (usou ESSE token)',
	bad && bad.code === 190,
	bad?.message?.slice(0, 70)
);
const missing = await fails('META_TOKEN_ZZ_AUSENTE');
check(
	'variável ausente dá erro claro',
	/não está configurada/.test(missing?.message ?? ''),
	missing?.message
);
const invalidName = await fails('DATABASE_URL');
check(
	'nome fora do padrão META_TOKEN_* é barrado',
	/inválido/.test(invalidName?.message ?? ''),
	invalidName?.message
);

// Contextos simultâneos não se misturam
const [a, b] = await Promise.all([
	withAccountToken(
		{ tokenEnv: 'META_TOKEN_ZZ_BOM' },
		async () => (await graph('me', { params: { fields: 'id' } })).id
	),
	fails('META_TOKEN_ZZ_RUIM')
]);
check('chamadas simultâneas com tokens diferentes não se misturam', Boolean(a) && b?.code === 190);

const h = await getTokenHealth({ tokenEnv: 'META_TOKEN_ZZ_BOM', force: true });
check('saúde do token por variável', h.configured && h.valid === true, `${h.type}`);
const h2 = await getTokenHealth({ tokenEnv: 'META_TOKEN_ZZ_AUSENTE' });
check('saúde de variável ausente avisa', h2.configured === false);

console.log(`\n${results.filter(Boolean).length}/${results.length} ok`);
process.exit(results.every(Boolean) ? 0 : 1);
