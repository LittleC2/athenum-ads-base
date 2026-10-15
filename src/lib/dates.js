// Datas como string 'YYYY-MM-DD' no fuso de São Paulo (o das contas). Módulo
// puro: roda no servidor e no navegador, e é fácil de testar.

const TZ = 'America/Sao_Paulo';

export function todayInSP(now = new Date()) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

export function addDays(dateStr, n) {
	const d = new Date(`${dateStr}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** Dias entre duas datas (b - a). */
export function diffDays(a, b) {
	return Math.round(
		(new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000
	);
}

export function monthStart(dateStr) {
	return `${dateStr.slice(0, 7)}-01`;
}

export function monthEnd(dateStr) {
	const [y, m] = dateStr.split('-').map(Number);
	return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function daysInMonth(dateStr) {
	return Number(monthEnd(dateStr).slice(8, 10));
}

export function toDbDate(dateStr) {
	return new Date(`${dateStr}T00:00:00Z`);
}

export function fromDbDate(date) {
	return date.toISOString().slice(0, 10);
}

/** 'dd/mm' */
export function shortBR(dateStr) {
	return `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}`;
}

/** 'dd/mm/aaaa' */
export function fullBR(dateStr) {
	return `${dateStr.slice(8, 10)}/${dateStr.slice(5, 7)}/${dateStr.slice(0, 4)}`;
}

export const PERIOD_LABELS = {
	'7d': 'Últimos 7 dias',
	'30d': 'Últimos 30 dias',
	month: 'Este mês',
	lastmonth: 'Mês passado'
};

/**
 * Período pedido e o período anterior equivalente (pra comparação).
 * @returns {{ since: string, until: string, prevSince: string, prevUntil: string, label: string }}
 */
export function periodFromPreset(preset, today = todayInSP()) {
	if (preset === '30d') {
		return {
			since: addDays(today, -29),
			until: today,
			prevSince: addDays(today, -59),
			prevUntil: addDays(today, -30),
			label: PERIOD_LABELS['30d']
		};
	}
	if (preset === 'month') {
		const since = monthStart(today);
		const prevMonthEnd = addDays(since, -1);
		const prevSince = monthStart(prevMonthEnd);
		const day = Number(today.slice(8, 10));
		const prevDays = daysInMonth(prevMonthEnd);
		return {
			since,
			until: today,
			prevSince,
			prevUntil: `${prevSince.slice(0, 8)}${String(Math.min(day, prevDays)).padStart(2, '0')}`,
			label: PERIOD_LABELS.month
		};
	}
	if (preset === 'lastmonth') {
		const thisStart = monthStart(today);
		const until = addDays(thisStart, -1);
		const since = monthStart(until);
		const prevUntil = addDays(since, -1);
		return {
			since,
			until,
			prevSince: monthStart(prevUntil),
			prevUntil,
			label: PERIOD_LABELS.lastmonth
		};
	}
	return {
		since: addDays(today, -6),
		until: today,
		prevSince: addDays(today, -13),
		prevUntil: addDays(today, -7),
		label: PERIOD_LABELS['7d']
	};
}

export function normalizePreset(value) {
	return value in PERIOD_LABELS ? value : '7d';
}

/** Período livre {since, until} com o período anterior de mesmo tamanho. */
export function customPeriod(since, until) {
	const len = diffDays(since, until) + 1;
	return {
		since,
		until,
		prevSince: addDays(since, -len),
		prevUntil: addDays(since, -1),
		label: `${shortBR(since)} a ${shortBR(until)}`
	};
}
