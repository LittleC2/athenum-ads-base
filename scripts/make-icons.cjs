// Gera os ícones PNG do PWA (192, 512 e maskable) a partir de um SVG com a marca "A".
const { chromium } = require('playwright');
const path = require('node:path');
const svg = (
	size,
	pad
) => `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">
<div style="width:${size - pad * 2}px;height:${size - pad * 2}px;border-radius:${(size - pad * 2) * 0.22}px;background:#cda76b;display:flex;align-items:center;justify-content:center;color:#000;font:800 ${(size - pad * 2) * 0.6}px 'Segoe UI',Arial,sans-serif">A</div></body></html>`;
(async () => {
	const b = await chromium.launch();
	for (const [name, size, pad] of [
		['icon-192.png', 192, 0],
		['icon-512.png', 512, 0],
		['icon-maskable-512.png', 512, 64]
	]) {
		const p = await b.newPage({ viewport: { width: size, height: size } });
		await p.setContent(svg(size, pad));
		await p.screenshot({ path: path.join(__dirname, '..', 'static', 'icons', name) });
	}
	await b.close();
	console.log('ícones gerados');
})();
