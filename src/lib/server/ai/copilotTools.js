// Ferramentas do copiloto. As de LEITURA consultam o banco já sincronizado.
// As de PROPOSTA nunca escrevem na Meta: só colocam uma ação PENDENTE na fila,
// que o gestor aprova na tela de Ações. O copiloto não tem como executar nada.
import { z } from 'zod';
import { db } from '../db.js';
import { loadOverview } from '../overview.js';
import { loadBreakdowns, loadDashboardForPeriod, summarizeBreakdown } from '../dashboard.js';
import { proposeAction } from '../actions.js';
import { createReportDraft } from '../reports.js';
import { generateCopies } from './copy.js';
import { planCampaign } from './planner.js';
import { accountHistory } from './history.js';
import { lintCopy } from '../../copyLint.js';
import { OBJECTIVES, OBJECTIVE_KEYS } from '../../campaignSpec.js';
import { normalizePreset, periodFromPreset } from '../../dates.js';
import { brl, decimal, pct } from '../../format.js';
import { RESULT_LABELS } from '../../metrics.js';

const PERIOD = z
	.enum(['7d', '30d', 'month', 'lastmonth'])
	.default('7d')
	.describe('Período: 7d, 30d, month (este mês) ou lastmonth');
const money = (c) => (c == null ? null : brl(c));

async function accountOrThrow(id) {
	const account = await db.adAccount.findUnique({ where: { id }, include: { client: true } });
	if (!account) throw new Error('Conta não encontrada. Use listar_clientes para ver os ids.');
	return account;
}

/** @type {{ name: string, description: string, schema: import('zod').ZodObject<any>, run: (input: any, ctx: { adminId: string }) => Promise<unknown> }[]} */
export const TOOLS = [
	{
		name: 'listar_clientes',
		description:
			'Lista os clientes e as contas de anúncios (com os ids) e um resumo dos últimos 7 dias de cada conta. Comece por aqui para descobrir ids.',
		schema: z.object({}),
		async run() {
			const overview = await loadOverview();
			return overview.map((c) => ({
				clientId: c.id,
				cliente: c.name,
				contas: c.accounts.map((a) => ({
					accountId: a.id,
					nome: a.name,
					resultado: RESULT_LABELS[a.resultType].title,
					ultimos7dias: {
						investido: money(a.cur.spendCents),
						resultados: a.cur.results,
						custo: money(a.cur.costCents),
						custoAlvo: money(a.targetCostCents)
					},
					alertasAbertos: a.alerts
				}))
			}));
		}
	},
	{
		name: 'resumo_conta',
		description:
			'Números de uma conta em um período, com comparação ao período anterior: investimento, resultados, custo, alcance, frequência, ritmo do orçamento, campanhas e anúncios.',
		schema: z.object({ accountId: z.string(), periodo: PERIOD }),
		async run({ accountId, periodo }) {
			const account = await accountOrThrow(accountId);
			const d = await loadDashboardForPeriod(account, periodFromPreset(normalizePreset(periodo)));
			const l = RESULT_LABELS[account.resultType];
			return {
				periodo: `${d.period.since} a ${d.period.until}`,
				tipoDeResultado: l.title,
				atual: {
					investido: money(d.cur.spendCents),
					resultados: d.cur.results,
					custoPorResultado: money(d.cur.costCents),
					alcance: d.cur.reach,
					frequencia: d.cur.frequency != null ? decimal(d.cur.frequency) : null,
					ctrLink: d.cur.ctr != null ? pct(d.cur.ctr, 2) : null,
					cpm: money(d.cur.cpmCents)
				},
				anterior: {
					investido: money(d.prev.spendCents),
					resultados: d.prev.results,
					custoPorResultado: money(d.prev.costCents)
				},
				variacaoPct: d.changes,
				orcamentoMensal: d.pacing
					? {
							gasto: money(d.pacing.spentCents),
							planejado: money(d.pacing.monthlyBudgetCents),
							projecao: money(d.pacing.projectedCents),
							ritmo: d.pacing.status
						}
					: null,
				campanhas: d.campaigns
					.filter((c) => c.spendCents > 0)
					.slice(0, 10)
					.map((c) => ({
						id: c.id,
						nome: c.name,
						situacao: c.status,
						investido: money(c.spendCents),
						resultados: c.results,
						custo: money(c.costCents)
					})),
				anuncios: d.ads
					.filter((a) => a.spendCents > 0)
					.slice(0, 15)
					.map((a) => ({
						id: a.id,
						nome: a.name,
						situacao: a.status,
						investido: money(a.spendCents),
						resultados: a.results,
						custo: money(a.costCents)
					}))
			};
		}
	},
	{
		name: 'detalhar_quebra',
		description:
			'Quebra de uma conta por idade e gênero ou por posicionamento (onde o anúncio aparece), com custo por resultado.',
		schema: z.object({
			accountId: z.string(),
			tipo: z.enum(['idade_genero', 'posicionamento']),
			periodo: PERIOD
		}),
		async run({ accountId, tipo, periodo }) {
			const account = await accountOrThrow(accountId);
			const b = await loadBreakdowns(account, normalizePreset(periodo));
			const rows =
				tipo === 'idade_genero'
					? summarizeBreakdown(b.age, account.resultType, (r) => `${r.age} ${r.gender}`)
					: summarizeBreakdown(
							b.placement,
							account.resultType,
							(r) => `${r.publisher_platform} ${r.platform_position}`
						);
			return rows.slice(0, 14).map((r) => ({
				grupo: r.key,
				investido: money(r.spendCents),
				participacaoDoGasto: pct(r.share, 0),
				resultados: r.results,
				custo: money(r.costCents)
			}));
		}
	},
	{
		name: 'listar_alertas',
		description: 'Alertas abertos de uma conta (ou de todas, sem accountId).',
		schema: z.object({ accountId: z.string().optional() }),
		async run({ accountId }) {
			const alerts = await db.alert.findMany({
				where: { status: 'OPEN', ...(accountId ? { accountId } : {}) },
				orderBy: [{ severity: 'asc' }, { lastSeenAt: 'desc' }],
				include: { account: { select: { name: true } } },
				take: 40
			});
			return alerts.map((a) => ({
				conta: a.account.name,
				gravidade: a.severity,
				titulo: a.title,
				detalhe: a.detail
			}));
		}
	},
	{
		name: 'listar_entidades',
		description:
			'Lista campanhas, conjuntos ou anúncios de uma conta com ids, status e orçamento diário. Necessário antes de propor pausar, ativar ou mudar orçamento.',
		schema: z.object({
			accountId: z.string(),
			nivel: z.enum(['CAMPAIGN', 'ADSET', 'AD']),
			somenteAtivos: z.boolean().default(true)
		}),
		async run({ accountId, nivel, somenteAtivos }) {
			const rows = await db.metaEntity.findMany({
				where: { accountId, level: nivel, ...(somenteAtivos ? { effectiveStatus: 'ACTIVE' } : {}) },
				orderBy: { name: 'asc' },
				take: 80
			});
			return rows.map((e) => ({
				id: e.externalId,
				nome: e.name,
				situacao: e.effectiveStatus,
				orcamentoDiario: money(e.dailyBudgetCents)
			}));
		}
	},
	{
		name: 'melhores_anuncios',
		description: 'Os anúncios com melhor custo por resultado da conta nos últimos 60 dias.',
		schema: z.object({ accountId: z.string() }),
		async run({ accountId }) {
			const h = await accountHistory(await accountOrThrow(accountId));
			return h.bestAds;
		}
	},
	// --- Propostas (só entram na fila de aprovação) --------------------------------
	{
		name: 'propor_pausar',
		description:
			'Propõe pausar uma campanha, conjunto ou anúncio. Vai para a fila de Ações; o gestor aprova. Use o id de listar_entidades.',
		schema: z.object({
			accountId: z.string(),
			entityId: z.string(),
			nome: z.string(),
			motivo: z.string()
		}),
		async run({ accountId, entityId, nome, motivo }, { adminId }) {
			const a = await proposeAction({
				type: 'PAUSE_ENTITY',
				summary: `Pausar "${nome}". Motivo: ${motivo}`,
				payload: { accountId, entityId },
				source: 'COPILOT',
				userId: adminId
			});
			return {
				propostaCriada: true,
				id: a.id,
				aviso: 'Aguardando aprovação do gestor na tela de Ações. Nada foi alterado na Meta.'
			};
		}
	},
	{
		name: 'propor_ativar',
		description:
			'Propõe ativar (ligar gasto) uma campanha, conjunto ou anúncio pausado. Vai para a fila de Ações.',
		schema: z.object({
			accountId: z.string(),
			entityId: z.string(),
			nome: z.string(),
			motivo: z.string()
		}),
		async run({ accountId, entityId, nome, motivo }, { adminId }) {
			const a = await proposeAction({
				type: 'ACTIVATE_ENTITY',
				summary: `Ativar "${nome}". Motivo: ${motivo}`,
				payload: { accountId, entityId },
				source: 'COPILOT',
				userId: adminId
			});
			return {
				propostaCriada: true,
				id: a.id,
				aviso: 'Aguardando aprovação do gestor. Nada foi alterado na Meta.'
			};
		}
	},
	{
		name: 'propor_orcamento',
		description:
			'Propõe mudar o orçamento diário de uma campanha (CBO) ou conjunto (ABO). Valor em reais. Respeita o teto de segurança da conta.',
		schema: z.object({
			accountId: z.string(),
			entityId: z.string(),
			nome: z.string(),
			novoOrcamentoReais: z.number().min(6),
			motivo: z.string()
		}),
		async run({ accountId, entityId, nome, novoOrcamentoReais, motivo }, { adminId }) {
			const cents = Math.round(novoOrcamentoReais * 100);
			const a = await proposeAction({
				type: 'CHANGE_BUDGET',
				summary: `Orçamento de "${nome}" para ${brl(cents)} por dia. Motivo: ${motivo}`,
				payload: { accountId, entityId, newDailyBudgetCents: cents },
				source: 'COPILOT',
				userId: adminId
			});
			return {
				propostaCriada: true,
				id: a.id,
				aviso: 'Aguardando aprovação do gestor. Nada foi alterado na Meta.'
			};
		}
	},
	{
		name: 'criar_rascunho_campanha',
		description:
			'Monta um rascunho de campanha (estrutura, público, orçamento e anúncios com criativos da biblioteca). Não envia nada à Meta: o gestor revisa e envia na tela de Campanhas.',
		schema: z.object({
			accountId: z.string(),
			objetivo: z.enum(OBJECTIVE_KEYS),
			nome: z.string(),
			instrucoes: z.string().default('')
		}),
		async run({ accountId, objetivo, nome, instrucoes }, { adminId }) {
			const account = await accountOrThrow(accountId);
			const [brief, assets, copies, history] = await Promise.all([
				db.clientBrief.findUnique({ where: { clientId: account.clientId } }),
				db.asset.findMany({
					where: { clientId: account.clientId },
					select: { id: true, name: true, kind: true }
				}),
				db.copyVariant.findMany({
					where: { clientId: account.clientId, status: 'APPROVED' },
					take: 12
				}),
				accountHistory(account)
			]);
			const plan = await planCampaign({
				objective: objetivo,
				account,
				client: account.client,
				brief,
				instructions: instrucoes,
				assets,
				copies,
				history,
				name: nome
			});
			const draft = await db.campaignDraft.create({
				data: {
					clientId: account.clientId,
					accountId: account.id,
					name: nome,
					objective: objetivo,
					spec: plan.spec,
					plannerNotes: plan.rationale,
					createdById: adminId
				}
			});
			return {
				rascunhoCriado: true,
				id: draft.id,
				link: `/admin/campanhas/${draft.id}`,
				objetivo: OBJECTIVES[objetivo].label,
				justificativa: plan.rationale
			};
		}
	},
	{
		name: 'gerar_copys',
		description:
			'Gera variantes de copy para um cliente e salva na biblioteca como "sugeridas" (o gestor aprova depois).',
		schema: z.object({
			clientId: z.string(),
			objetivo: z.enum(OBJECTIVE_KEYS),
			angulos: z.string().default(''),
			quantidade: z.number().int().min(1).max(8).default(4)
		}),
		async run({ clientId, objetivo, angulos, quantidade }) {
			const client = await db.client.findUnique({ where: { id: clientId } });
			if (!client) throw new Error('Cliente não encontrado.');
			const [brief, existing] = await Promise.all([
				db.clientBrief.findUnique({ where: { clientId } }),
				db.copyVariant.findMany({
					where: { clientId, status: { not: 'REJECTED' } },
					take: 10,
					select: { primaryText: true }
				})
			]);
			const variants = await generateCopies({
				objective: objetivo,
				brief,
				clientName: client.name,
				angles: angulos,
				count: quantidade,
				instructions: '',
				existing: existing.map((e) => e.primaryText)
			});
			await db.copyVariant.createMany({
				data: variants.map((v) => ({
					clientId,
					angle: v.angle,
					primaryText: v.primaryText,
					headline: v.headline,
					description: v.description || null,
					lintFlags: lintCopy(v),
					source: 'claude'
				}))
			});
			return {
				criadas: variants.length,
				link: `/admin/biblioteca?cliente=${clientId}`,
				variantes: variants.map((v) => ({
					angulo: v.angle,
					titulo: v.headline,
					texto: v.primaryText.slice(0, 160)
				}))
			};
		}
	},
	{
		name: 'gerar_relatorio',
		description:
			'Gera o rascunho de relatório de uma conta para um período. O gestor revisa e publica no portal do cliente.',
		schema: z.object({ accountId: z.string(), periodo: PERIOD }),
		async run({ accountId, periodo }) {
			const report = await createReportDraft(
				await accountOrThrow(accountId),
				periodFromPreset(normalizePreset(periodo))
			);
			return {
				rascunhoCriado: true,
				id: report.id,
				link: `/admin/relatorios/${report.id}`,
				escritoPor: report.generatedBy
			};
		}
	}
];
