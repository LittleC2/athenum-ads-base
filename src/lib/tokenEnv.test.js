import { describe, expect, it } from 'vitest';
import { isValidTokenEnv, suggestTokenEnv } from './tokenEnv.js';

describe('tokenEnv', () => {
	it('aceita só nomes META_TOKEN_*', () => {
		expect(isValidTokenEnv('META_TOKEN_CLINICA')).toBe(true);
		expect(isValidTokenEnv('META_TOKEN_SOFTWARE_EXEMPLO_2')).toBe(true);
		expect(isValidTokenEnv('DATABASE_URL')).toBe(false);
		expect(isValidTokenEnv('ANTHROPIC_API_KEY')).toBe(false);
		expect(isValidTokenEnv('META_TOKEN_')).toBe(false);
		expect(isValidTokenEnv('meta_token_x')).toBe(false);
		expect(isValidTokenEnv('')).toBe(false);
		expect(isValidTokenEnv(null)).toBe(false);
	});

	it('sugere o nome a partir do slug', () => {
		expect(suggestTokenEnv('software-exemplo')).toBe('META_TOKEN_SOFTWARE_EXEMPLO');
		expect(suggestTokenEnv('Loja Exemplo (Matriz)')).toBe('META_TOKEN_LOJA_EXEMPLO_MATRIZ');
		expect(isValidTokenEnv(suggestTokenEnv('---'))).toBe(true);
	});
});
