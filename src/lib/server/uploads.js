// Armazenamento dos criativos (imagens e vídeos) enviados pelo gestor.
// Em produção UPLOADS_DIR aponta pra um Volume do Railway (o disco comum é efêmero).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { env } from '$env/dynamic/private';

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png' };
const VIDEO_TYPES = { 'video/mp4': '.mp4', 'video/quicktime': '.mov' };

export function uploadsRoot() {
	return path.resolve(env.UPLOADS_DIR || './data/uploads');
}

/** @returns {{ kind: 'IMAGE'|'VIDEO', ext: string } | null} */
export function classify(mimeType) {
	if (IMAGE_TYPES[mimeType]) return { kind: 'IMAGE', ext: IMAGE_TYPES[mimeType] };
	if (VIDEO_TYPES[mimeType]) return { kind: 'VIDEO', ext: VIDEO_TYPES[mimeType] };
	return null;
}

/** Grava o arquivo e devolve o caminho relativo guardado no banco. */
export async function saveUpload(clientId, file, ext) {
	const rel = path.join(clientId, `${randomUUID()}${ext}`);
	const abs = path.join(uploadsRoot(), rel);
	await mkdir(path.dirname(abs), { recursive: true });
	await writeFile(abs, Buffer.from(await file.arrayBuffer()));
	return rel;
}

/** Lê um arquivo guardado. Recusa caminho que escape da pasta de uploads. */
export async function readUpload(rel) {
	const root = uploadsRoot();
	const abs = path.resolve(root, rel);
	if (!abs.startsWith(root + path.sep)) throw new Error('Caminho de arquivo inválido.');
	return readFile(abs);
}

/** Apaga o arquivo do disco (sem erro se já não existir). Mesma trava de caminho do readUpload. */
export async function deleteUpload(rel) {
	const root = uploadsRoot();
	const abs = path.resolve(root, rel);
	if (!abs.startsWith(root + path.sep)) throw new Error('Caminho de arquivo inválido.');
	await rm(abs, { force: true });
}
