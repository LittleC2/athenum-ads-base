// Variáveis dos scripts de teste ao vivo. Ficam no .env (nunca no código): ver .env.example.
import 'dotenv/config';

export function requireEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`Defina ${name} no .env (veja .env.example).`);
	return value;
}
