import { describe, expect, it } from 'vitest';
import { optionalFloat, optionalInt, toCents } from './money.js';

describe('toCents', () => {
	it('aceita formatos brasileiros e simples', () => {
		expect(toCents('R$ 1.234,56')).toEqual({ value: 123456 });
		expect(toCents('3.000,00')).toEqual({ value: 300000 });
		expect(toCents('1234.5')).toEqual({ value: 123450 });
		expect(toCents('500')).toEqual({ value: 50000 });
		expect(toCents('12,3')).toEqual({ value: 1230 });
	});
	it('vazio vira null e lixo é erro', () => {
		expect(toCents('')).toEqual({ value: null });
		expect(toCents('abc')).toEqual({ error: true });
		expect(toCents('-5')).toEqual({ error: true });
	});
});

describe('optionalInt e optionalFloat', () => {
	it('valida limites', () => {
		expect(optionalInt('12')).toEqual({ value: 12 });
		expect(optionalInt('')).toEqual({ value: null });
		expect(optionalInt('1,5')).toEqual({ error: true });
		expect(optionalInt('99999999')).toEqual({ error: true });
		expect(optionalFloat('12,5')).toEqual({ value: 12.5 });
		expect(optionalFloat('101')).toEqual({ error: true });
	});
});
