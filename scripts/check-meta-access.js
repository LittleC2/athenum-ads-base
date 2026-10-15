// Confere, para cada conta cadastrada no app: qual token ela usa (o geral ou o META_TOKEN_*
// dela), se o token está válido e se dá pra ler a conta. Mostra também o que já foi
// compartilhado com a BM da Athenum (caminho do token geral de System User).
// Uso: npx vite-node --config vitest.config.js scripts/check-meta-access.js
import { db } from '../src/lib/server/db.js';
import { graph, paginate, withAccountToken } from '../src/lib/server/meta/client.js';
import { getTokenHealth } from '../src/lib/server/meta/token.js';

const BM = process.env.META_BUSINESS_ID ?? '';
const accounts = await db.adAccount.findMany({
	include: { client: true },
	orderBy: { createdAt: 'asc' }
});

const describeToken = (h) =>
	!h.configured
		? 'NÃO configurado'
		: `${h.type ?? '?'} ${h.valid ? 'válido' : 'INVÁLIDO'}, ${h.expiresAt ? `expira em ${h.daysLeft} dias` : 'sem expiração'}${h.missingScopes?.length ? `, faltam: ${h.missingScopes.join(',')}` : ''}`;

console.log('TOKENS');
const seen = new Set();
for (const a of accounts) {
	const key = a.tokenEnv ?? 'geral';
	if (seen.has(key)) continue;
	seen.add(key);
	const h = await getTokenHealth({ force: true, tokenEnv: a.tokenEnv });
	console.log(
		`  ${(a.tokenEnv ?? 'META_ADS_ACCESS_TOKEN (geral)').padEnd(34)} ${describeToken(h)}`
	);
}

console.log('\nCONTAS');
for (const a of accounts) {
	const readable = await withAccountToken(a, () =>
		graph(a.externalId, { params: { fields: 'name' } }).then(
			() => true,
			(e) => e.message.slice(0, 60)
		)
	);
	console.log(
		`  ${a.client.name.padEnd(26)} token ${(a.tokenEnv ?? 'geral').padEnd(24)} ${readable === true ? 'lê ok' : 'SEM acesso: ' + readable}`
	);
}

// O que já foi compartilhado com a sua BM (só vale pro token geral; defina META_BUSINESS_ID no .env)
if (BM) {
	const shared = new Set(
		(await paginate(`${BM}/client_ad_accounts`, { fields: 'id', limit: 200 }).catch(() => [])).map(
			(a) => a.id
		)
	);
	console.log(
		`\nCompartilhadas com a sua BM: ${accounts.filter((a) => shared.has(a.externalId)).length} de ${accounts.length}`
	);
}
process.exit(0);
