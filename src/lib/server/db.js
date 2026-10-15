import { PrismaClient } from '../../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '$env/dynamic/private';

// Uma instância só de PrismaClient por processo (em dev o Vite recarrega
// módulos e abriria uma conexão nova a cada mudança).
const globalForPrisma = globalThis;

function createClient() {
	// DB_POOL_MAX limita conexões em dev: o Postgres descartável do `prisma dev` aceita pouca concorrência.
	const max = Number(env.DB_POOL_MAX) || undefined;
	const idleTimeoutMillis = Number(env.DB_IDLE_MS) || undefined;
	const adapter = new PrismaPg({
		connectionString: env.DATABASE_URL,
		max,
		idleTimeoutMillis,
		connectionTimeoutMillis: 20000
	});
	return new PrismaClient({ adapter });
}

// Banco remoto (Neon): a conexão e as transações demoram mais que num Postgres local.
export const TX_OPTIONS = { maxWait: 20000, timeout: 60000 };

export const db = globalForPrisma.__prismaAds ?? createClient();

if (env.NODE_ENV !== 'production') {
	globalForPrisma.__prismaAds = db;
}
