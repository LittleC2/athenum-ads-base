// Porta de entrada pelo terminal (Claude Code): faz o mesmo que o painel, usando o
// mesmo código, os mesmos guardas e a mesma auditoria. Uso:
//   npm run ads -- <comando> [argumentos] [--flags]
// Sem argumento, lista os comandos.
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/lib/server/db.js';
import { loadOverview } from '../src/lib/server/overview.js';
import { loadDashboardForPeriod } from '../src/lib/server/dashboard.js';
import { syncAccount, syncAll } from '../src/lib/server/sync.js';
import { createReportDraft } from '../src/lib/server/reports.js';
import {
	ACTION_TYPES,
	executeAction,
	proposeAction,
	rejectAction
} from '../src/lib/server/actions.js';
import { setStatus, validateDraftOnMeta } from '../src/lib/server/meta/builder.js';
import { audit } from '../src/lib/server/audit.js';
import { withAccountToken } from '../src/lib/server/meta/client.js';
import { classify, saveUpload } from '../src/lib/server/uploads.js';
import { planCampaign } from '../src/lib/server/ai/planner.js';
import { generateCopies } from '../src/lib/server/ai/copy.js';
import { accountHistory } from '../src/lib/server/ai/history.js';
import { getTokenHealth } from '../src/lib/server/meta/token.js';
import { sendDigestIfChanged } from '../src/lib/server/notify.js';
import { renewToken } from '../src/lib/server/meta/renew.js';
import { hasAnthropic } from '../src/lib/server/ai/anthropic.js';
import {
	OBJECTIVES,
	SpecSchema,
	emptySpec,
	hasBlockingIssues,
	totalDailyBudgetCents,
	validateSpec
} from '../src/lib/campaignSpec.js';
import { normalizePreset, periodFromPreset } from '../src/lib/dates.js';
import { brl, decimal, int, pct, signedPct } from '../src/lib/format.js';
import { RESULT_LABELS } from '../src/lib/metrics.js';

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--')));
const args = rest.filter((a) => !a.startsWith('--'));
const out = (...l) => console.log(...l);

async function admin() {
	const u = await db.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
	if (!u) throw new Error('Nenhum admin cadastrado. Rode npm run db:seed.');
	return u;
}

/** Aceita slug do cliente, nome parcial ou act_id. */
async function findAccount(key) {
	if (!key) throw new Error('Informe o cliente (slug, nome ou act_id).');
	const k = key.toLowerCase();
	const accounts = await db.adAccount.findMany({
		include: { client: true },
		orderBy: { createdAt: 'asc' }
	});
	const hit =
		accounts.find((a) => a.externalId === key || a.client.slug === k) ??
		accounts.find(
			(a) => a.client.name.toLowerCase().includes(k) || a.name.toLowerCase().includes(k)
		);
	if (!hit) throw new Error(`Cliente não encontrado: ${key}. Use: npm run ads -- contas`);
	return hit;
}

async function findDraft(id) {
	const d = await db.campaignDraft.findUnique({
		where: { id },
		include: { account: true, client: true }
	});
	if (!d) throw new Error(`Rascunho não encontrado: ${id}`);
	return d;
}

const need = (flag, why) => {
	if (!flags.has(flag)) throw new Error(`${why} Repita o comando com ${flag} para confirmar.`);
};

const commands = {
	async ajuda() {
		out(`Comandos (npm run ads -- <comando>):
 Leitura
  contas                              clientes e contas, últimos 7 dias
  resumo <cliente> [7d|30d|month|lastmonth]
  alertas [cliente]
  sync <cliente> [--completo]         sincroniza com a Meta
  avisos [--teste]                    e-mail aos admins se as pendências críticas mudaram (precisa RESEND_API_KEY)
  sync-todas                          sincroniza todas as contas ativas (usado pelo agendamento)
  token                               saúde do token da Meta
  renovar-token [META_TOKEN_X]        troca o token por um novo de 60 dias (precisa META_APP_ID/SECRET no .env)
  melhores <cliente>                  melhores anúncios (60 dias)
 Biblioteca
  assets <cliente>                    criativos
  asset-add <cliente> <arquivo>       envia imagem/vídeo pra biblioteca
  copys <cliente>                     copys da biblioteca
  gerar-copys <cliente> <objetivo> [angulos]   (precisa da chave da IA)
 Relatórios
  relatorio <cliente> [periodo]       gera rascunho (não publica)
 Campanhas (tudo nasce PAUSADO na Meta)
  rascunhos [cliente]
  rascunho <cliente> <OBJETIVO> "<nome>" [--ia]
  rascunho-excluir <id>               apaga (se ainda não foi pra Meta)
  spec <id>                           mostra a estrutura e os problemas
  spec-set <id> <arquivo.json>        grava a estrutura
  validar <id>                        valida na Meta sem criar nada
  enviar <id> --confirmo              cria na Meta, pausada
  ativar <id> --confirmo-gasto        LIGA o gasto
  pausar <id>                         pausa na Meta
 Fila de ações
  acoes                               pendentes
  aprovar <id> [--confirmo-gasto]     |  rejeitar <id>`);
	},

	async contas() {
		for (const c of await loadOverview()) {
			out(`\n${c.name}`);
			for (const a of c.accounts) {
				const l = RESULT_LABELS[a.resultType];
				out(
					`  ${a.name} | 7d: ${brl(a.cur.spendCents)} | ${int(a.cur.results)} ${l.plural} | ${l.cost.toLowerCase()} ${a.cur.costCents != null ? brl(a.cur.costCents) : '-'}${a.costChange != null ? ` (${signedPct(a.costChange, 0)})` : ''} | alertas V${a.alerts.RED} A${a.alerts.YELLOW} +${a.alerts.GREEN}`
				);
			}
		}
	},

	async resumo() {
		const account = await findAccount(args[0]);
		const period = periodFromPreset(normalizePreset(args[1] ?? '7d'));
		const d = await loadDashboardForPeriod(account, period);
		const l = RESULT_LABELS[account.resultType];
		out(`${account.client.name} | ${period.since} a ${period.until}`);
		out(
			`Investido ${brl(d.cur.spendCents)} (${d.changes.spend != null ? signedPct(d.changes.spend, 0) : '-'}) | ${l.title} ${int(d.cur.results)} (${d.changes.results != null ? signedPct(d.changes.results, 0) : '-'}) | ${l.cost} ${d.cur.costCents != null ? brl(d.cur.costCents) : '-'} (${d.changes.cost != null ? signedPct(d.changes.cost, 0) : '-'})`
		);
		out(
			`Alcance ${d.cur.reach != null ? int(d.cur.reach) : '-'} | frequência ${d.cur.frequency != null ? decimal(d.cur.frequency) : '-'} | CTR ${d.cur.ctr != null ? pct(d.cur.ctr, 2) : '-'} | CPM ${d.cur.cpmCents != null ? brl(d.cur.cpmCents) : '-'}`
		);
		if (d.pacing)
			out(
				`Orçamento do mês: ${brl(d.pacing.spentCents)} de ${brl(d.pacing.monthlyBudgetCents)} | projeção ${brl(d.pacing.projectedCents)} (${d.pacing.status})`
			);
		out('\nCampanhas:');
		for (const c of d.campaigns.filter((x) => x.spendCents > 0).slice(0, 8))
			out(
				`  ${(c.status ?? '').padEnd(10)} ${brl(c.spendCents).padStart(12)} ${String(c.results).padStart(5)}  ${c.costCents != null ? brl(c.costCents) : '-'}  ${c.name}`
			);
		out('Anúncios (top gasto):');
		for (const a of d.ads.filter((x) => x.spendCents > 0).slice(0, 10))
			out(
				`  ${(a.status ?? '').padEnd(10)} ${brl(a.spendCents).padStart(12)} ${String(a.results).padStart(5)}  ${a.costCents != null ? brl(a.costCents) : '-'}  ${a.name}`
			);
	},

	async alertas() {
		const where = {
			status: 'OPEN',
			...(args[0] ? { accountId: (await findAccount(args[0])).id } : {})
		};
		const rows = await db.alert.findMany({
			where,
			orderBy: [{ severity: 'asc' }],
			include: { account: { include: { client: true } } }
		});
		for (const a of rows)
			out(`[${a.severity}] ${a.account.client.name}: ${a.title}\n      ${a.detail}`);
		if (!rows.length) out('Nenhum alerta aberto.');
	},

	async sync() {
		const a = await findAccount(args[0]);
		const r = await syncAccount(a.id, { fullBackfill: flags.has('--completo') });
		out(`Sincronizado ${a.client.name}:`, JSON.stringify(r));
	},

	async avisos() {
		const r = await sendDigestIfChanged({ force: flags.has('--teste') });
		out(r.sent ? `Aviso enviado (${r.items} pendência(s)).` : `Nada enviado: ${r.reason}`);
	},

	async 'sync-todas'() {
		const rows = await syncAll({ fullBackfill: flags.has('--completo') });
		for (const r of rows) out(r.account, r.error ? `ERRO: ${r.error}` : JSON.stringify(r));
		if (rows.some((r) => r.error)) process.exitCode = 1;
	},

	async token() {
		const t = await getTokenHealth({ force: true });
		out(
			`tipo ${t.type ?? '-'} | válido ${t.valid ?? '-'} | expira ${t.expiresAt ? `${t.expiresAt.toISOString().slice(0, 10)} (${t.daysLeft} dias)` : 'nunca'}`
		);
		out(
			`permissões: ${(t.scopes ?? []).join(', ')}${t.missingScopes?.length ? ` | FALTAM: ${t.missingScopes.join(', ')}` : ''}`
		);
		if (t.warning ?? t.error) out('AVISO:', t.warning ?? t.error);
		out(`IA (Claude): ${hasAnthropic() ? 'configurada' : 'sem ANTHROPIC_API_KEY'}`);
	},

	async 'renovar-token'() {
		const r = await renewToken({ tokenEnv: args[0] ?? null });
		out(
			`${r.envName} renovado e gravado no .env. Expira em ${r.expiresAt ? r.expiresAt.toISOString().slice(0, 10) : 'data desconhecida'}.`
		);
		out('Se o painel já está no ar, atualize essa variável lá também.');
	},

	async melhores() {
		const h = await accountHistory(await findAccount(args[0]));
		for (const a of h.bestAds) out(`${a.name} | ${a.results} resultados | ${a.cost}`);
		if (!h.bestAds.length) out('Sem anúncios com volume suficiente nos últimos 60 dias.');
	},

	async assets() {
		const a = await findAccount(args[0]);
		for (const x of await db.asset.findMany({
			where: { clientId: a.clientId },
			orderBy: { createdAt: 'desc' }
		}))
			out(
				`${x.id} | ${x.kind} | ${x.name} | ${(x.sizeBytes / 1048576).toFixed(1)} MB${x.metaImageHash || x.metaVideoId ? ' | já na Meta' : ''}`
			);
	},

	async 'asset-add'() {
		const a = await findAccount(args[0]);
		const file = path.resolve(args[1] ?? '');
		if (!fs.existsSync(file)) throw new Error(`Arquivo não encontrado: ${file}`);
		const ext = path.extname(file).toLowerCase();
		const mime = {
			'.jpg': 'image/jpeg',
			'.jpeg': 'image/jpeg',
			'.png': 'image/png',
			'.mp4': 'video/mp4',
			'.mov': 'video/quicktime'
		}[ext];
		const kind = mime && classify(mime);
		if (!kind) throw new Error('Formato não aceito (JPG, PNG, MP4 ou MOV).');
		const buf = fs.readFileSync(file);
		const rel = await saveUpload(
			a.clientId,
			new File([buf], path.basename(file), { type: mime }),
			kind.ext
		);
		const asset = await db.asset.create({
			data: {
				clientId: a.clientId,
				kind: kind.kind,
				name: path.basename(file, ext),
				filePath: rel,
				mimeType: mime,
				sizeBytes: buf.length
			}
		});
		await audit({
			userId: (await admin()).id,
			clientId: a.clientId,
			action: 'cli.asset.upload',
			target: asset.name
		});
		out(`Criativo adicionado: ${asset.id} (${asset.kind}, ${asset.name})`);
	},

	async copys() {
		const a = await findAccount(args[0]);
		for (const c of await db.copyVariant.findMany({
			where: { clientId: a.clientId },
			orderBy: { createdAt: 'desc' },
			take: 30
		}))
			out(
				`${c.id} | ${c.status} | [${c.angle}] ${c.headline}\n   ${c.primaryText.slice(0, 140).replace(/\n/g, ' ')}`
			);
	},

	async 'gerar-copys'() {
		const a = await findAccount(args[0]);
		const objective = args[1];
		if (!OBJECTIVES[objective])
			throw new Error(`Objetivo inválido. Use: ${Object.keys(OBJECTIVES).join(', ')}`);
		const brief = await db.clientBrief.findUnique({ where: { clientId: a.clientId } });
		const v = await generateCopies({
			objective,
			brief,
			clientName: a.client.name,
			angles: args[2] ?? '',
			count: 5,
			instructions: '',
			existing: []
		});
		await db.copyVariant.createMany({
			data: v.map((x) => ({
				clientId: a.clientId,
				angle: x.angle,
				primaryText: x.primaryText,
				headline: x.headline,
				description: x.description || null,
				lintFlags: x.lintFlags,
				source: 'claude'
			}))
		});
		for (const x of v) out(`[${x.angle}] ${x.headline}\n   ${x.primaryText}`);
		out(`\n${v.length} variantes salvas como sugeridas (aprove no painel).`);
	},

	async relatorio() {
		const a = await findAccount(args[0]);
		const r = await createReportDraft(a, periodFromPreset(normalizePreset(args[1] ?? '7d')));
		out(
			`Rascunho ${r.id} (escrito por ${r.generatedBy}). Revise e publique em /admin/relatorios/${r.id}\n\n${r.clientSummary}`
		);
	},

	async rascunhos() {
		const where = args[0] ? { clientId: (await findAccount(args[0])).clientId } : {};
		for (const d of await db.campaignDraft.findMany({
			where,
			orderBy: { updatedAt: 'desc' },
			take: 30,
			include: { client: true }
		}))
			out(`${d.id} | ${d.status.padEnd(9)} | ${d.client.name} | ${d.name}`);
	},

	async rascunho() {
		const a = await findAccount(args[0]);
		const objective = args[1];
		const name = args[2];
		if (!OBJECTIVES[objective] || !name)
			throw new Error('Uso: rascunho <cliente> <OBJETIVO> "<nome>" [--ia]');
		let spec = emptySpec(objective, name);
		let notes = null;
		if (flags.has('--ia')) {
			const [brief, assets, copies, history] = await Promise.all([
				db.clientBrief.findUnique({ where: { clientId: a.clientId } }),
				db.asset.findMany({
					where: { clientId: a.clientId },
					select: { id: true, name: true, kind: true }
				}),
				db.copyVariant.findMany({ where: { clientId: a.clientId, status: 'APPROVED' }, take: 12 }),
				accountHistory(a)
			]);
			const plan = await planCampaign({
				objective,
				account: a,
				client: a.client,
				brief,
				instructions: '',
				assets,
				copies,
				history,
				name
			});
			spec = plan.spec;
			notes = plan.rationale;
		}
		const d = await db.campaignDraft.create({
			data: {
				clientId: a.clientId,
				accountId: a.id,
				name,
				objective,
				spec,
				plannerNotes: notes,
				createdById: (await admin()).id
			}
		});
		out(
			`Rascunho criado: ${d.id}\nEdite com: spec ${d.id} / spec-set ${d.id} <arquivo.json>  |  painel: /admin/campanhas/${d.id}`
		);
	},

	async 'rascunho-excluir'() {
		const d = await findDraft(args[0]);
		if (d.metaCampaignId)
			throw new Error('Já existe na Meta: pause e arquive no Gerenciador de Anúncios.');
		await db.campaignDraft.delete({ where: { id: d.id } });
		await audit({
			userId: (await admin()).id,
			clientId: d.clientId,
			action: 'cli.draft.delete',
			target: d.name
		});
		out('Rascunho excluído.');
	},

	async spec() {
		const d = await findDraft(args[0]);
		const spec = SpecSchema.parse(d.spec);
		const assets = await db.asset.findMany({ where: { clientId: d.clientId } });
		out(JSON.stringify(spec, null, 2));
		const issues = validateSpec(spec, d.account, {
			assetIds: new Set(assets.map((x) => x.id)),
			assetKinds: Object.fromEntries(assets.map((x) => [x.id, x.kind]))
		});
		out(`\nOrçamento diário total: ${brl(totalDailyBudgetCents(spec))} | status ${d.status}`);
		for (const i of issues) out(`${i.level === 'error' ? 'CORRIGIR' : 'atenção'}: ${i.message}`);
		if (!issues.length) out('Sem problemas.');
	},

	async 'spec-set'() {
		const d = await findDraft(args[0]);
		if (d.metaCampaignId && d.status !== 'FAILED')
			throw new Error('Já está na Meta: não dá para editar a estrutura.');
		const parsed = SpecSchema.parse(JSON.parse(fs.readFileSync(path.resolve(args[1]), 'utf8')));
		await db.campaignDraft.update({
			where: { id: d.id },
			data: { spec: parsed, name: parsed.campaignName, status: 'DRAFT', lastError: null }
		});
		await audit({
			userId: (await admin()).id,
			clientId: d.clientId,
			accountId: d.accountId,
			action: 'cli.draft.update',
			target: parsed.campaignName
		});
		out('Estrutura gravada. Rode: spec', d.id);
	},

	async validar() {
		const d = await findDraft(args[0]);
		const spec = SpecSchema.parse(d.spec);
		const assets = await db.asset.findMany({ where: { clientId: d.clientId } });
		const issues = validateSpec(spec, d.account, {
			assetIds: new Set(assets.map((x) => x.id)),
			assetKinds: Object.fromEntries(assets.map((x) => [x.id, x.kind]))
		});
		for (const i of issues) out(`${i.level === 'error' ? 'CORRIGIR' : 'atenção'}: ${i.message}`);
		if (hasBlockingIssues(issues))
			throw new Error('Há problemas a corrigir antes de validar na Meta.');
		for (const r of await validateDraftOnMeta(d.id))
			out(`${r.ok ? 'ok ' : 'FALHA'} ${r.ad}: ${r.message}`);
	},

	async enviar() {
		need('--confirmo', 'Isto cria a campanha na Meta (pausada).');
		const d = await findDraft(args[0]);
		const u = await admin();
		const act = await proposeAction({
			type: 'UPLOAD_DRAFT',
			summary: `Enviar "${d.name}" para a Meta (pausada) [via terminal]`,
			payload: { draftId: d.id },
			source: 'MANUAL',
			userId: u.id
		});
		const r = await executeAction(act.id, u.id);
		out(`Enviada pausada. Campanha ${r.campaignId}. Anúncios com falha: ${r.failedAds}.`);
	},

	async ativar() {
		need('--confirmo-gasto', 'Isto LIGA o gasto de verdade.');
		const d = await findDraft(args[0]);
		const total = totalDailyBudgetCents(SpecSchema.parse(d.spec));
		const u = await admin();
		const act = await proposeAction({
			type: 'ACTIVATE_DRAFT',
			summary: `Ativar "${d.name}" (até ${brl(total)} por dia) [via terminal]`,
			payload: { draftId: d.id },
			source: 'MANUAL',
			userId: u.id
		});
		await executeAction(act.id, u.id);
		out(`Campanha ativa. Gasto diário de até ${brl(total)}.`);
	},

	async pausar() {
		const d = await findDraft(args[0]);
		if (!d.metaCampaignId) throw new Error('Esta campanha ainda não está na Meta.');
		await withAccountToken(d.account, () => setStatus(d.metaCampaignId, 'PAUSED'));
		await db.campaignDraft.update({ where: { id: d.id }, data: { status: 'UPLOADED' } });
		await audit({
			userId: (await admin()).id,
			clientId: d.clientId,
			accountId: d.accountId,
			action: 'cli.meta.PAUSE_CAMPAIGN',
			target: d.name
		});
		out('Campanha pausada na Meta.');
	},

	async acoes() {
		for (const a of await db.proposedAction.findMany({
			where: { status: 'PENDING' },
			orderBy: { createdAt: 'asc' }
		}))
			out(`${a.id} | ${ACTION_TYPES[a.type] ?? a.type} | ${a.summary}`);
		out('(fim da fila pendente)');
	},

	async aprovar() {
		const a = await db.proposedAction.findUnique({ where: { id: args[0] ?? '' } });
		if (!a) throw new Error('Ação não encontrada.');
		if (['ACTIVATE_DRAFT', 'ACTIVATE_ENTITY', 'CHANGE_BUDGET'].includes(a.type))
			need('--confirmo-gasto', 'Esta ação mexe em gasto.');
		await executeAction(a.id, (await admin()).id);
		out('Ação executada:', a.summary);
	},

	async rejeitar() {
		await rejectAction(args[0], (await admin()).id);
		out('Ação rejeitada.');
	}
};

const READ_ONLY = new Set([
	'ajuda',
	'contas',
	'resumo',
	'alertas',
	'token',
	'melhores',
	'assets',
	'copys',
	'rascunhos',
	'spec',
	'acoes',
	'validar'
]);
const isConnectionError = (e) =>
	/Connection terminated|ECONNRESET|ECONNREFUSED/.test(String(e?.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
	const fn = commands[cmd ?? 'ajuda'];
	if (!fn) throw new Error(`Comando desconhecido: ${cmd}. Use: npm run ads -- ajuda`);
	try {
		await fn();
	} catch (err) {
		// O Postgres local de desenvolvimento às vezes derruba a conexão; leituras podem repetir com segurança.
		if (READ_ONLY.has(cmd ?? 'ajuda') && isConnectionError(err)) {
			await sleep(2000);
			await fn();
		} else throw err;
	}
} catch (err) {
	console.error('ERRO:', err.userMessage || err.message);
	process.exitCode = 1;
} finally {
	await db.$disconnect();
}
