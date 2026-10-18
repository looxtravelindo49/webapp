import { error } from '@sveltejs/kit';
import { getStore, mimeForName, UPLOAD_NAME } from '#lib/server/uploads.js';
import type { RequestHandler } from './$types';

/**
 * Menyajikan foto yang diunggah admin. Publik (gambar harus terlihat pengunjung). Hanya nama yang
 * kita buat sendiri (UUID + jpg|png|webp|avif) yang dilayani; selain itu 404 tanpa menyentuh penyimpanan,
 * sehingga `..`, `/`, dan nama sembarang tidak pernah sampai ke disk atau Blob. Isi disajikan langsung
 * (bukan dialihkan) agar header pengaman tetap kita kendalikan dan URL penyimpanan tidak bocor.
 */
export const GET: RequestHandler = async ({ params }) => {
	const mime = mimeForName(params.name);
	if (!UPLOAD_NAME.test(params.name) || !mime) error(404, 'Tidak ditemukan');
	const found = await getStore().get(params.name);
	if (!found) error(404, 'Tidak ditemukan');
	return new Response(found.body as BodyInit, {
		headers: {
			'Content-Type': mime,
			'X-Content-Type-Options': 'nosniff',
			// Nama acak dan tidak pernah ditimpa → aman di-cache selamanya.
			'Cache-Control': 'public, max-age=31536000, immutable',
			// CDN (Vercel) menyimpan hasilnya sehingga fungsi hanya dipanggil saat cache dingin.
			'CDN-Cache-Control': 'public, max-age=31536000, immutable',
			'Content-Security-Policy': "default-src 'none'; img-src 'self'"
		}
	});
};
