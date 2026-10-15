import { describe, expect, it } from 'vitest';
import { explainMetaError } from './metaErrors.js';

describe('explainMetaError', () => {
	it('explica o app em modo de desenvolvimento (erro real da Meta)', () => {
		const msg = explainMetaError({
			message: 'Invalid parameter',
			userMessage:
				'O post do criativo dos anúncios foi criado por um app que está em modo de desenvolvimento. Ele deve estar em modo público para criar este anúncio.'
		});
		expect(msg).toMatch(/modo "Ao vivo"/);
	});

	it('explica os termos de leads da página (erro real da Meta)', () => {
		const msg = explainMetaError({
			message: 'Invalid parameter',
			userMessage:
				'Você não pode veicular anúncios de cadastros até sua Página do Facebook aceitar os Termos de Serviço de Geração de Cadastros do Facebook.'
		});
		expect(msg).toMatch(/Página do Facebook precisa aceitar/);
	});

	it('mantém a mensagem original quando não conhece o erro', () => {
		expect(explainMetaError({ message: 'Algo novo' })).toBe('Algo novo');
	});
});
