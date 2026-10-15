import { describe, expect, it } from 'vitest';
import { cleanToken, redactSecrets } from './redact.js';

describe('redact', () => {
	it('esconde token em mensagem de erro', () => {
		const msg = `Headers.append: "Bearer EAAFAKEFAKEFAKEFAKEFAKEFAKEFAKE0000" is invalid`;
		expect(redactSecrets(msg)).not.toContain('EAAFAKE');
		expect(redactSecrets(msg)).toContain('[token oculto]');
	});
	it('token colado com outra linha junto vira só o token', () => {
		expect(cleanToken('EAAabc123\nMETA_GRAPH_VERSION=v21.0')).toBe('EAAabc123');
		expect(cleanToken('  EAAabc123  ')).toBe('EAAabc123');
		expect(cleanToken(undefined)).toBe('');
	});
});
