import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig([
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},

	{
		files: ['**/*.svelte', '**/*.svelte.js'],
		languageOptions: { parserOptions: {} }
	},

	{
		// Service worker: globais próprios (self, clients, registration),
		// não os de página/DOM comum.
		files: ['static/sw.js'],
		languageOptions: { globals: globals.serviceworker }
	},

	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {
			// O app roda na raiz do domínio (sem base path), então resolve() só adicionaria ruído.
			'svelte/no-navigation-without-resolve': 'off'
		}
	}
]);
