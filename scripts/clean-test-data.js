// Remove rascunhos e relatórios criados pelo e2e (nome começa com "E2E").
import { db } from '../src/lib/server/db.js';
const d = await db.campaignDraft.deleteMany({ where: { name: { startsWith: 'E2E' } } });
const r = await db.report.deleteMany({ where: { clientSummary: { contains: 'Teste e2e' } } });
console.log('rascunhos removidos:', d.count, '| relatórios removidos:', r.count);
process.exit(0);
