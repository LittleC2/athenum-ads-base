import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/guards.js';
import { db } from '$lib/server/db.js';
import { readUpload } from '$lib/server/uploads.js';

// Pré-visualização do criativo na biblioteca. Só o gestor acessa.
export const GET = async ({ params, locals }) => {
	requireAdmin(locals);
	const asset = await db.asset.findUnique({ where: { id: params.id } });
	if (!asset) throw error(404, 'Criativo não encontrado.');
	const buffer = await readUpload(asset.filePath);
	return new Response(buffer, {
		headers: { 'Content-Type': asset.mimeType, 'Cache-Control': 'private, max-age=3600' }
	});
};
