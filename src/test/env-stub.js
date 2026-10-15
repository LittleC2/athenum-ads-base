// Substitui o módulo virtual $env/dynamic/private do SvelteKit em testes e
// scripts rodados fora do Vite do app.
import 'dotenv/config';

export const env = process.env;
