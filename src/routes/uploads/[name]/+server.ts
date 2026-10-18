import { error } from '@sveltejs/kit';
import { existsSync, readFileSync } from 'node:fs';
import { mimeForName, uploadDir, uploadFile } from '#lib/server/uploads.js';
import type { RequestHandler } from './$types';

/**
 * Menyajikan foto yang diunggah admin. Publik (gambar harus terlihat pengunjung). Hanya nama yang
 * kita buat sendiri (UUID + jpg|png|webp|avif) yang dilayani; selain itu 404, sehingga `..`, `/`,
 * dan nama sembarang tidak pernah menyentuh disk.
 */
export const GET: RequestHandler = ({ params }) => {
	const file = uploadFile(params.name, uploadDir());
	const mime = mimeForName(params.name);
	if (!file || !mime || !existsSync(file)) error(404, 'Tidak ditemukan');
	return new Response(readFileSync(file), {
		headers: {
			'Content-Type': mime,
			'X-Content-Type-Options': 'nosniff',
			// Nama acak dan tidak pernah ditimpa → aman di-cache selamanya.
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Content-Security-Policy': "default-src 'none'; img-src 'self'"
		}
	});
};
