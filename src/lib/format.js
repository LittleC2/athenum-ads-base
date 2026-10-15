// Formatação pt-BR compartilhada entre servidor e telas.

const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const intFmt = new Intl.NumberFormat('pt-BR');

/** Centavos -> 'R$ 1.234,56'. */
export function brl(cents) {
	if (cents == null || Number.isNaN(cents)) return '-';
	return brlFmt.format(cents / 100);
}

export function int(n) {
	if (n == null || Number.isNaN(n)) return '-';
	return intFmt.format(Math.round(n));
}

export function pct(n, digits = 1) {
	if (n == null || !Number.isFinite(n)) return '-';
	return `${n.toFixed(digits).replace('.', ',')}%`;
}

/** Variação percentual com sinal: '+12,3%'. */
export function signedPct(n, digits = 1) {
	if (n == null || !Number.isFinite(n)) return '-';
	const s = n.toFixed(digits).replace('.', ',');
	return `${n > 0 ? '+' : ''}${s}%`;
}

export function decimal(n, digits = 2) {
	if (n == null || !Number.isFinite(n)) return '-';
	return n.toFixed(digits).replace('.', ',');
}

const STATUS = {
	ACTIVE: ['Ativa', 'success'],
	PAUSED: ['Pausada', ''],
	CAMPAIGN_PAUSED: ['Pausada', ''],
	ADSET_PAUSED: ['Pausada', ''],
	IN_PROCESS: ['Em análise', 'warn'],
	PENDING_REVIEW: ['Em análise', 'warn'],
	PREAPPROVED: ['Em análise', 'warn'],
	DISAPPROVED: ['Reprovada', 'danger'],
	WITH_ISSUES: ['Com problema', 'danger'],
	ARCHIVED: ['Arquivada', ''],
	DELETED: ['Excluída', '']
};

/** Status da Meta -> [texto em português, variante de cor do badge]. */
export function statusLabel(status) {
	return STATUS[status] ?? [status ? status.toLowerCase() : 'Sem dado', ''];
}

/** "há 5 min", "há 2 h", "ontem"... pra mostrar a idade de um dado. */
export function ago(date, now = Date.now()) {
	if (!date) return 'nunca';
	const min = Math.max(0, Math.round((now - new Date(date).getTime()) / 60000));
	if (min < 2) return 'agora mesmo';
	if (min < 60) return `há ${min} min`;
	const h = Math.round(min / 60);
	if (h < 24) return `há ${h} h`;
	const d = Math.round(h / 24);
	return d === 1 ? 'ontem' : `há ${d} dias`;
}
