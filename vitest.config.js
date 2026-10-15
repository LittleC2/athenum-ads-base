import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Config separada do vite.config.js (que carrega o plugin do SvelteKit): os
// testes e os scripts via vite-node só precisam resolver $lib e $env.
export default defineConfig({
	resolve: {
		alias: {
			$lib: path.resolve('src/lib'),
			'$env/dynamic/private': path.resolve('src/test/env-stub.js')
		}
	},
	test: {
		include: ['src/**/*.test.js'],
		environment: 'node'
	}
});
