// Cria o admin inicial. Com SEED_EXAMPLE_CLIENTS=1 cria também 2 clientes de exemplo (dev/demo).
// Rodar com: npm run db:seed. Pode rodar de novo sem duplicar nada.
import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from './seed-helpers.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const email = (process.env.SEED_ADMIN_EMAIL ?? '').trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD ?? '';
if (!email || password.length < 8) {
	console.error('Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD (mínimo 8 caracteres) no .env.');
	process.exit(1);
}

await db.user.upsert({
	where: { email },
	update: { passwordHash: await hashPassword(password), role: 'ADMIN', active: true },
	create: {
		email,
		name: 'Gestor',
		passwordHash: await hashPassword(password),
		role: 'ADMIN',
		mustChangePassword: false
	}
});
console.log(`Admin pronto: ${email}`);

// Clientes de EXEMPLO, só pra ver o painel funcionando em dev. Os IDs são fictícios: não existem na Meta,
// então a sincronização dessas contas falha. Cadastre os clientes reais pelo painel (Clientes > Novo).
const clients =
	process.env.SEED_EXAMPLE_CLIENTS === '1'
		? [
				{
					slug: 'clinica-exemplo',
					name: 'Clínica Exemplo',
					segment: 'Saúde e estética',
					account: {
						externalId: 'act_100000000000001',
						name: 'Clínica Exemplo',
						resultType: 'WHATSAPP',
						monthlyBudgetCents: 200000,
						targetCostCents: 1200
					},
					brief: {
						offer: 'Avaliação e procedimentos de estética.',
						audience: 'Mulheres de 25 a 54 anos na região da clínica.',
						tone: 'Natural, sutil, sem exageros.',
						ticketCents: 50000
					}
				},
				{
					slug: 'software-exemplo',
					name: 'Software Exemplo',
					segment: 'Tecnologia (SaaS B2B)',
					account: {
						externalId: 'act_100000000000002',
						name: 'SOFTWARE | EXEMPLO',
						resultType: 'LEAD_FORM',
						targetCostCents: 3500
					},
					brief: {
						offer: 'Software de gestão para clínicas.',
						audience: 'Donos de clínica no Brasil.',
						tone: 'Direto, focado em resultado.'
					}
				}
			]
		: [];

for (const c of clients) {
	const client = await db.client.upsert({
		where: { slug: c.slug },
		update: { name: c.name, segment: c.segment },
		create: { slug: c.slug, name: c.name, segment: c.segment }
	});
	await db.clientBrief.upsert({
		where: { clientId: client.id },
		update: {},
		create: { clientId: client.id, ...c.brief }
	});
	await db.adAccount.upsert({
		where: { externalId: c.account.externalId },
		update: {},
		create: { clientId: client.id, ...c.account }
	});
	console.log(`Cliente pronto: ${c.name}`);
}

await db.$disconnect();
