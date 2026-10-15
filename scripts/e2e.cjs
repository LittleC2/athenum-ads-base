// Percurso de ponta a ponta no navegador contra o servidor de dev (porta 5190).
// Uso: NODE_PATH=<MazyOS>/node_modules node scripts/e2e.cjs
// Confere isolamento entre clientes, todas as telas do gestor, o fluxo de
// relatório (gerar, publicar, cliente ler) e o de rascunho de campanha.
require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:5190';
const OUT = process.env.E2E_OUT || path.join(__dirname, '..', 'data', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, extra = '') => {
	results.push({ name, ok });
	console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${extra ? ' | ' + extra : ''}`);
};
const text = async (page) => (await page.textContent('body')) ?? '';

async function login(page, email, password) {
	await page.goto(`${BASE}/login`);
	await page.fill('#email', email);
	await page.fill('#password', password);
	await Promise.all([
		page.waitForURL((u) => !u.pathname.startsWith('/login')),
		page.click('button[type=submit]')
	]);
}

(async () => {
	const browser = await chromium.launch();
	const errors = [];
	const watch = (page, tag) => {
		page.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
		page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e.message}`));
	};

	// ---- Gestor: todas as telas ----
	const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const admin = await adminCtx.newPage();
	watch(admin, 'admin');
	await login(admin, process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD);
	check('gestor cai em /admin', new URL(admin.url()).pathname === '/admin');

	const clinicaHref = await admin.$eval('a:has-text("Clínica Exemplo")', (a) =>
		a.getAttribute('href')
	);
	const screens = [
		['/admin', 'Visão geral'],
		['/admin/clientes', 'Clientes'],
		[`${clinicaHref}`, 'Investido'],
		[`${clinicaHref}?aba=contas`, 'Vincular conta'],
		[`${clinicaHref}?aba=brief`, 'Briefing'],
		[`${clinicaHref}?aba=acessos`, 'Logins do portal'],
		['/admin/alertas', 'Alertas'],
		['/admin/relatorios', 'Relatórios'],
		['/admin/campanhas', 'Campanhas'],
		['/admin/campanhas/nova', 'Nova campanha'],
		['/admin/biblioteca', 'Biblioteca'],
		['/admin/acoes', 'Ações'],
		['/admin/ajustes', 'Token da Meta']
	];
	for (const [route, expected] of screens) {
		const res = await admin.goto(`${BASE}${route}`);
		await admin.waitForLoadState('networkidle');
		const ok = res.status() === 200 && new RegExp(expected, 'i').test(await text(admin));
		check(`tela ${route}`, ok, `${res.status()}`);
		await admin.screenshot({
			path: path.join(OUT, `admin-${route.replace(/[^a-z0-9]+/gi, '_')}.png`),
			fullPage: true
		});
	}

	// ---- Relatório: gerar -> editar -> publicar ----
	await admin.goto(`${BASE}/admin/relatorios`);
	await admin.selectOption('#acc', { label: /Clínica/ }).catch(async () => {
		const opt = await admin.$eval('#acc option', (o) => o.value);
		await admin.selectOption('#acc', opt);
	});
	await admin.click('button:has-text("Gerar rascunho")');
	await admin.waitForURL(/\/admin\/relatorios\/.+/, { timeout: 60000 });
	const reportUrl = admin.url();
	const reportId = reportUrl.split('/').pop();
	check('relatório gerado como rascunho', /rascunho/.test(await text(admin)));
	const summary = await admin.inputValue('textarea[name=clientSummary]');
	check(
		'texto do cliente tem números e sem travessão',
		/R\$/.test(summary) && !/[—–]/.test(summary)
	);
	await admin.fill('textarea[name=clientSummary]', summary + '\n\nTeste e2e: edição do gestor.');
	await admin.click('button:has-text("Salvar alterações")');
	await admin.waitForTimeout(800);
	await admin.screenshot({ path: path.join(OUT, 'admin-relatorio-detalhe.png'), fullPage: true });
	await admin.click('button:has-text("Publicar no portal do cliente")');
	await admin.waitForTimeout(1000);
	check('relatório publicado', /Publicado no portal/.test(await text(admin)));

	// ---- Rascunho de campanha: criar -> preencher -> salvar -> validar ----
	await admin.goto(`${BASE}/admin/campanhas/nova`);
	const wppAccount = await admin.$$eval(
		'#acc option',
		(os) => os.find((o) => /Clínica/.test(o.textContent))?.value
	);
	await admin.selectOption('#acc', wppAccount);
	await admin.selectOption('#obj', 'LEADS_WHATSAPP');
	await admin.fill('#name', 'E2E - campanha de teste (não enviar)');
	const aiBox = await admin.$('input[name=useAI]');
	if (aiBox && (await aiBox.isEnabled()) && (await aiBox.isChecked())) await aiBox.uncheck();
	await admin.click('button:has-text("Criar rascunho")');
	await admin.waitForURL(
		(u) => /^\/admin\/campanhas\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith('/nova')
	);
	await admin.waitForSelector('text=1. Campanha');
	const draftUrl = admin.url();
	check('rascunho criado e editor abre', /1\. Campanha/.test(await text(admin)));
	check('revisão bloqueia envio de spec vazia', /Corrigir:/.test(await text(admin)));
	const sendDisabled = await admin.$eval('button:has-text("Enviar pausada")', (b) => b.disabled);
	check('botão enviar fica desabilitado com erros', sendDisabled === true);
	await admin.fill('#sb0', '30,00');
	await admin.click('button:has-text("Adicionar anúncio")');
	await admin.screenshot({ path: path.join(OUT, 'admin-campanha-editor.png'), fullPage: true });
	await admin.click('button:has-text("Salvar rascunho")');
	await admin.waitForTimeout(800);
	check('rascunho salvo', /Rascunho salvo/.test(await text(admin)));
	await admin.goto(draftUrl);
	await admin.waitForSelector('#sb0');
	check('valores persistiram após recarregar', (await admin.inputValue('#sb0')).includes('30'));
	await admin.click('button:has-text("Excluir rascunho")');
	await admin.waitForURL(/\/admin\/campanhas$/);
	await admin.goto(`${BASE}/admin/campanhas`);
	await admin.waitForLoadState('networkidle');
	check('rascunho de teste excluído', !/E2E - campanha de teste/.test(await text(admin)));

	// ---- Cliente Clínica ----
	const pw = process.env.TEST_CLIENT_PASSWORD;
	const tCtx = await browser.newContext({
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 2
	});
	const t = await tCtx.newPage();
	watch(t, 'clinica');
	await login(t, 'clinica.teste@example.com', pw);
	check('cliente cai em /painel', new URL(t.url()).pathname === '/painel');
	await t.waitForLoadState('networkidle');
	await t.screenshot({ path: path.join(OUT, 'cliente-painel-mobile.png'), fullPage: true });
	const clientText = await text(t);
	check('cliente vê o resumo publicado pelo gestor', /Resumo da semana/.test(clientText));
	check(
		'cliente vê só a própria conta (sem o outro cliente)',
		!/SOFTWARE|Software Exemplo/.test(clientText)
	);
	check(
		'cliente não vê campos internos',
		!/Meta de custo|Profundidade|NO_RESULT|Frequência/.test(clientText)
	);

	await t.goto(`${BASE}/admin`);
	check('cliente não acessa /admin', new URL(t.url()).pathname === '/painel');
	await t.goto(`${BASE}/admin/relatorios/${reportId}`);
	check('cliente não abre tela de relatório do gestor', new URL(t.url()).pathname === '/painel');
	const apiRes = await t.goto(`${BASE}/api/admin/copiloto`);
	check(
		'cliente não acessa API do copiloto',
		new URL(t.url()).pathname === '/painel' || apiRes.status() >= 400
	);
	await t.goto(`${BASE}/painel/relatorios/${reportId}`);
	await t.screenshot({ path: path.join(OUT, 'cliente-relatorio-mobile.png'), fullPage: true });
	check('cliente lê o relatório publicado dele', /Teste e2e: edição do gestor/.test(await text(t)));
	await t.goto(`${BASE}/painel?conta=conta-inexistente`);
	check('conta de outro cliente responde 404', /404|não encontrada/i.test(await text(t)));

	// Relatório da Clínica não aparece pro outro cliente
	const jCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	const j = await jCtx.newPage();
	watch(j, 'software');
	await login(j, 'software.teste@example.com', pw);
	const jRes = await j.goto(`${BASE}/painel/relatorios/${reportId}`);
	check('cliente B não lê relatório do cliente A (404)', jRes.status() === 404);
	await j.goto(`${BASE}/painel`);
	check(
		'painel do Software Exemplo mostra a conta dele',
		/SOFTWARE|Leads/.test(await text(j)) && !/Clínica/.test(await text(j))
	);
	await j.screenshot({ path: path.join(OUT, 'cliente-software-mobile.png'), fullPage: true });

	// limpeza do relatório de teste
	await admin.goto(reportUrl);
	await admin.click('button:has-text("Excluir")');
	await admin.waitForURL(/\/admin\/relatorios$/);

	await browser.close();
	const failed = results.filter((r) => !r.ok).length;
	const relevantErrors = errors.filter(
		(e) => !/favicon|manifest|Failed to load resource.*(404|403)/.test(e)
	);
	console.log(`\nErros de console: ${relevantErrors.length}`);
	relevantErrors.slice(0, 10).forEach((e) => console.log(' -', e.slice(0, 200)));
	console.log(`\n${results.length - failed}/${results.length} verificações ok`);
	process.exit(failed ? 1 : 0);
})();
