// Cria logins de cliente de TESTE (só dev local) pra Clínica Exemplo e Software Exemplo.
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../prisma/seed-helpers.js';

const db = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});
const password = process.env.TEST_CLIENT_PASSWORD;
if (!password) throw new Error('Defina TEST_CLIENT_PASSWORD no .env');

for (const [slug, email] of [
	['clinica-exemplo', 'clinica.teste@example.com'],
	['software-exemplo', 'software.teste@example.com']
]) {
	const client = await db.client.findUnique({ where: { slug } });
	await db.user.upsert({
		where: { email },
		update: { passwordHash: await hashPassword(password), active: true, mustChangePassword: false },
		create: {
			email,
			name: `Teste ${slug}`,
			role: 'CLIENT',
			clientId: client.id,
			passwordHash: await hashPassword(password)
		}
	});
	console.log('login de teste pronto:', email);
}
await db.$disconnect();
