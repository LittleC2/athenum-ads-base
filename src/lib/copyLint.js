// Checagem de texto de anúncio antes de ir pra Meta. Módulo puro.
// Limites são os de exibição recomendados pela Meta (acima disso o texto é
// cortado), e as regras de saúde evitam os motivos mais comuns de reprovação.
import { hasDash } from './text.js';

export const LIMITS = { primaryText: 125, headline: 40, description: 30 };

const HEALTH_CLAIMS = [
	[/\bcura(r|rá|mos)?\b/i, 'Evite "cura": promessa de resultado em saúde costuma reprovar.'],
	[/garantid[oa]s?|garantimos|garantia de resultado/i, 'Evite "garantido": não prometa resultado.'],
	[/100\s?%/i, 'Evite "100%": soa como promessa absoluta.'],
	[/milagr|milagros/i, 'Evite "milagre/milagroso".'],
	[/sem (dor|risco|efeitos colaterais)/i, 'Evite afirmar ausência de dor ou risco.'],
	[/emagre[çc]a|perca \d+\s?kg/i, 'Evite promessa de emagrecimento com números.']
];

const PERSONAL_ATTRIBUTES = [
	[
		/\b(você|vc) (está|esta|tem|sofre|possui)\b[^.!?]{0,40}\b(gord|acima do peso|depress|ansios|doen|diabet|calv|acne|rugas|flacid)/i,
		'Evite afirmar condição de saúde da pessoa ("você tem..."): política de atributos pessoais da Meta.'
	]
];

/**
 * @param {{ primaryText?: string, headline?: string, description?: string }} copy
 * @returns {{ level: 'error'|'warn', code: string, message: string }[]}
 */
export function lintCopy(copy) {
	const flags = [];
	const primaryText = copy.primaryText ?? '';
	const headline = copy.headline ?? '';
	const description = copy.description ?? '';
	const all = `${primaryText}\n${headline}\n${description}`;

	if (!primaryText.trim())
		flags.push({ level: 'error', code: 'EMPTY_PRIMARY', message: 'O texto principal está vazio.' });
	if (!headline.trim())
		flags.push({ level: 'error', code: 'EMPTY_HEADLINE', message: 'O título está vazio.' });

	// O texto principal pode passar de 125; só o começo aparece antes do "ver mais".
	if (primaryText.length > 600)
		flags.push({
			level: 'warn',
			code: 'LONG_PRIMARY',
			message: `Texto principal com ${primaryText.length} caracteres: muito longo.`
		});
	else if (primaryText.split('\n')[0].length > 125)
		flags.push({
			level: 'warn',
			code: 'LONG_FIRST_LINE',
			message: 'A primeira linha passa de 125 caracteres e será cortada antes do "ver mais".'
		});
	if (headline.length > LIMITS.headline)
		flags.push({
			level: 'warn',
			code: 'LONG_HEADLINE',
			message: `Título com ${headline.length} caracteres (ideal até ${LIMITS.headline}).`
		});
	if (description.length > LIMITS.description)
		flags.push({
			level: 'warn',
			code: 'LONG_DESCRIPTION',
			message: `Descrição com ${description.length} caracteres (ideal até ${LIMITS.description}).`
		});

	if (hasDash(all))
		flags.push({
			level: 'warn',
			code: 'DASH',
			message: 'Tem travessão (—). Troque por vírgula ou ponto.'
		});
	if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(all))
		flags.push({
			level: 'warn',
			code: 'EMOJI',
			message: 'Tem emoji. O padrão da Athenum evita emoji.'
		});
	if (/!{2,}|\?{2,}/.test(all))
		flags.push({ level: 'warn', code: 'PUNCTUATION', message: 'Pontuação repetida (!! ou ??).' });
	if (primaryText.length > 20 && primaryText === primaryText.toUpperCase())
		flags.push({ level: 'warn', code: 'ALL_CAPS', message: 'Texto todo em maiúsculas.' });

	for (const [re, message] of HEALTH_CLAIMS)
		if (re.test(all)) flags.push({ level: 'warn', code: 'HEALTH_CLAIM', message });
	for (const [re, message] of PERSONAL_ATTRIBUTES)
		if (re.test(all)) flags.push({ level: 'error', code: 'PERSONAL_ATTRIBUTE', message });

	return flags;
}

export function hasLintErrors(flags) {
	return flags.some((f) => f.level === 'error');
}
