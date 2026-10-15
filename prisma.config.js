// Config do Prisma CLI (migrate, studio, seed). O app em si (SvelteKit) lê
// as env vars pelo próprio Vite; este arquivo só serve pra rodar `prisma`
// fora do contexto do Vite.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
		seed: 'node prisma/seed.js'
	},
	datasource: {
		url: process.env.DATABASE_URL,
		shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL
	}
});
