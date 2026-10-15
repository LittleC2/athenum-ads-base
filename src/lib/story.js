// "A história" de uma conta em linguagem simples: estado de saúde, frase de resumo,
// funil do anúncio até o cliente, melhor dia e linha do tempo. Alimenta o painel do
// cliente (e o resumo do gestor). Módulo puro: recebe os números prontos, sem banco.
import { brl, int } from './format.js';
import { RESULT_LABELS } from './metrics.js';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Dia da semana de uma data 'YYYY-MM-DD' (sem depender de fuso). */
export function weekdayOf(dateStr) {
	const [y, m, d] = dateStr.split('-').map(Number);
	return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Série diária de um campo, pra mini-gráficos. */
export function seriesOf(series, field) {
	return series.map((s) => s[field] ?? 0);
}

/** Custo por resultado dia a dia (dia sem resultado repete o anterior pra linha não despencar). */
export function costSeries(series) {
	let last = 0;
	return series.map((s) => {
		if (s.results > 0) last = s.spendCents / s.results;
		return last;
	});
}

/** Melhor dia em resultados (empate: o mais recente). null se ninguém teve resultado. */
export function bestDay(series) {
	let best = null;
	for (const s of series) {
		if (s.results > 0 && (!best || s.results >= best.results)) best = s;
	}
	return best && { date: best.date, results: best.results, weekday: weekdayOf(best.date) };
}

function plural(n, one, many) {
	return n === 1 ? one : many;
}

function changeText(change, { lowerIsBetter = false } = {}) {
	if (change == null || Math.abs(change) < 0.05) return null;
	const pct = Math.round(Math.abs(change) * 100);
	const up = change > 0;
	if (lowerIsBetter) return up ? `${pct}% mais caro` : `${pct}% mais barato`;
	return up ? `${pct}% a mais` : `${pct}% a menos`;
}

/**
 * Estado de saúde da conta com uma frase que o cliente entende.
 * level: 'good' | 'watch' | 'bad' | 'idle'
 */
export function healthOf({ account, dashboard, redAlerts = 0 }) {
	const labels = RESULT_LABELS[account.resultType] ?? RESULT_LABELS.LEAD_FORM;
	const { cur, pacing } = dashboard;
	// pctChange devolve percentual (20 = +20%); aqui trabalhamos em fração (0,2).
	const changes = Object.fromEntries(
		Object.entries(dashboard.changes).map(([k, v]) => [k, v == null ? null : v / 100])
	);
	const days = dashboard.series.length;

	if (cur.spendCents <= 0) {
		return {
			level: 'idle',
			label: 'Sem anúncios rodando',
			headline: 'Nenhum anúncio rodou neste período.',
			detail: 'Escolha outro período ou fale com a gente se esperava ver anúncios no ar.'
		};
	}
	if (cur.results === 0) {
		const early = cur.spendCents < 3000;
		return {
			level: early ? 'watch' : 'bad',
			label: early ? 'Começando' : 'Sem resultado ainda',
			headline: early
				? 'Os anúncios acabaram de começar.'
				: `Os anúncios estão no ar, mas ainda sem ${labels.plural}.`,
			detail: early
				? 'Nos primeiros dias a Meta ainda está aprendendo a quem mostrar. É normal.'
				: 'Já estamos analisando o que ajustar. Você recebe notícias no resumo da semana.'
		};
	}

	const target = account.targetCostCents;
	const cost = cur.costCents;
	let level = 'good';
	const reasons = [];
	if (target && cost > target * 1.3) {
		level = 'bad';
		reasons.push(
			`o custo por ${labels.singular.replace(' no WhatsApp', '')} está acima do esperado`
		);
	} else if (target && cost > target * 1.1) {
		level = 'watch';
		reasons.push('o custo está um pouco acima do esperado');
	}
	if (changes.results != null && changes.results <= -0.3 && level === 'good') {
		level = 'watch';
		reasons.push(`vieram menos ${labels.plural} que no período anterior`);
	}
	if (pacing?.status === 'acima' && level === 'good') {
		level = 'watch';
		reasons.push('o investimento do mês está acima do planejado');
	}
	if (redAlerts > 0 && level === 'good') level = 'watch';

	const resultsPart = `${int(cur.results)} ${plural(cur.results, labels.singular, labels.plural)} em ${days} ${plural(days, 'dia', 'dias')}`;
	const delta = changeText(changes.results);
	if (level === 'good') {
		return {
			level,
			label: 'Indo bem',
			headline: 'Seus anúncios estão indo bem.',
			detail: `Foram ${resultsPart}${delta ? `, ${delta} que no período anterior` : ''}.`
		};
	}
	return {
		level,
		label: level === 'bad' ? 'Precisa de atenção' : 'Vale observar',
		headline:
			level === 'bad'
				? 'Os anúncios trouxeram resultado, mas pedem ajustes.'
				: 'Os anúncios estão funcionando, com um ponto de atenção.',
		detail: `Foram ${resultsPart}. Ponto de atenção: ${reasons.join(' e ') || 'acompanhando de perto'}. Já estamos cuidando disso.`
	};
}

/** Caminho do anúncio até virar cliente. Etapas sem dado ficam de fora. */
export function funnelOf({ account, dashboard, feedback = null }) {
	const labels = RESULT_LABELS[account.resultType] ?? RESULT_LABELS.LEAD_FORM;
	const { cur } = dashboard;
	const stages = [];
	if (cur.reach != null && cur.reach > 0)
		stages.push({ key: 'reach', name: 'Pessoas que viram', count: cur.reach });
	const clicks = cur.linkClicks || cur.clicks;
	if (clicks > 0) stages.push({ key: 'clicks', name: 'Clicaram no anúncio', count: clicks });
	stages.push({ key: 'results', name: labels.title, count: cur.results });
	if (feedback?.sales != null)
		stages.push({ key: 'sales', name: 'Viraram clientes', count: feedback.sales });
	return stages;
}

/** Linha do tempo em frases curtas: o "ao vivo" do cliente. */
export function activityOf({ account, dashboard, report = null, feedbackDue = false }) {
	const labels = RESULT_LABELS[account.resultType] ?? RESULT_LABELS.LEAD_FORM;
	const items = [];
	const today = dashboard.series.find((s) => s.date === dashboard.today);
	if (today && today.spendCents > 0) {
		items.push({
			icon: 'live',
			text: `Hoje: ${brl(today.spendCents)} investidos e ${int(today.results)} ${plural(today.results, labels.singular, labels.plural)} até agora.`
		});
	}
	const running = dashboard.campaigns.filter((c) => c.status === 'ACTIVE').length;
	if (running > 0) {
		items.push({
			icon: 'campaign',
			text: `${running} ${plural(running, 'campanha rodando', 'campanhas rodando')} neste momento.`
		});
	}
	const best = bestDay(dashboard.series);
	if (best) {
		items.push({
			icon: 'star',
			text: `Melhor dia do período: ${best.weekday}, com ${int(best.results)} ${plural(best.results, labels.singular, labels.plural)}.`
		});
	}
	const topAd = dashboard.ads.filter((a) => a.results > 0).sort((a, b) => b.results - a.results)[0];
	if (topAd) {
		items.push({
			icon: 'ad',
			text: `Anúncio que mais trouxe resultado: "${topAd.name}" (${int(topAd.results)} ${plural(topAd.results, labels.singular, labels.plural)}).`
		});
	}
	if (report) {
		items.push({
			icon: 'report',
			text: `Novo resumo da semana publicado: ${report.title}.`
		});
	}
	if (feedbackDue) {
		items.push({
			icon: 'ask',
			text: 'Conta pra gente quantos desses contatos viraram clientes. Isso melhora os próximos anúncios.',
			href: '/painel/resultados'
		});
	}
	return items;
}

/** Explicações curtas dos termos, pro "Entenda os números". */
export function glossaryFor(resultType) {
	const labels = RESULT_LABELS[resultType] ?? RESULT_LABELS.LEAD_FORM;
	return [
		{
			term: 'Investido',
			text: 'O quanto foi gasto com anúncios no período. É o valor cobrado pela Meta (Facebook e Instagram).'
		},
		{
			term: labels.title,
			text: `Quantas ${labels.plural} os anúncios geraram: ${labels.clientHint}.`
		},
		{
			term: labels.cost,
			text: `O quanto, em média, custou cada ${labels.singular}. Quanto menor, melhor.`
		},
		{
			term: 'Pessoas alcançadas',
			text: 'Quantas pessoas diferentes viram o seu anúncio pelo menos uma vez.'
		},
		{
			term: 'Cliques no anúncio',
			text: 'Quantas vezes alguém tocou no anúncio para saber mais.'
		},
		{
			term: 'Orçamento do mês',
			text: 'O quanto combinamos de investir no mês e como o gasto está andando em relação a isso.'
		}
	];
}
