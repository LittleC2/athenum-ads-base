import { db } from './db.js';

export async function getSetting(key, fallback) {
	const row = await db.setting.findUnique({ where: { key } });
	return row ? row.value : fallback;
}

export async function setSetting(key, value) {
	await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Trava geral: com ela ligada, nada escreve na Meta (criar, ativar, pausar, mudar verba). */
export async function metaWritesDisabled() {
	return Boolean(await getSetting('metaWritesDisabled', false));
}
