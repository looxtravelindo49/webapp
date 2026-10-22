import { MAX_PORTFOLIO_BATCH, MAX_PORTFOLIO_BATCH_BYTES, type PortfolioPhotoText } from '#lib/portfolio-form.js';
import type { Db } from './db';
import { compressToWebp, PORTFOLIO_MAX_BYTES } from './image-compress.js';
import { addPortfolioPhotos } from './portfolio.js';
import { deleteUpload, detectImageType, getStore, MAX_UPLOAD_BYTES, saveImage, type ImageStore } from './uploads.js';

export const COMPRESS_MESSAGE = 'Foto tidak bisa dikompresi. Pilih JPEG, PNG, WebP, atau AVIF lain.';

export type IncomingPhoto = { name: string; bytes: Uint8Array };

const cleanup = (store: ImageStore, path: string) => deleteUpload(store, path).catch((err) => console.error('[uploads] gagal menghapus', path, err));

/** Baca semua berkas `photo`. Menolak jenis, ukuran per berkas, jumlah, dan total sekaligus. */
export async function readPortfolioPhotos(form: FormData): Promise<{ ok: true; photos: IncomingPhoto[] } | { ok: false; error: string }> {
	const files = form.getAll('photo').filter((file): file is File => file instanceof File && (file.size > 0 || file.name !== ''));
	if (files.length === 0) return { ok: false, error: 'Pilih minimal satu foto.' };
	if (files.length > MAX_PORTFOLIO_BATCH) return { ok: false, error: `Unggah paling banyak ${MAX_PORTFOLIO_BATCH} foto sekaligus.` };
	let total = 0;
	const photos: IncomingPhoto[] = [];
	for (const file of files) {
		if (file.size === 0) return { ok: false, error: 'Berkas foto kosong. Pilih foto lain.' };
		if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'Setiap foto maksimal 4 MB.' };
		total += file.size;
		if (total > MAX_PORTFOLIO_BATCH_BYTES) return { ok: false, error: 'Unggah paling banyak 4 MB sekaligus. Sisanya bisa diunggah lagi.' };
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (!detectImageType(bytes)) return { ok: false, error: 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.' };
		photos.push({ name: file.name, bytes });
	}
	return { ok: true, photos };
}

/** Kompres setiap foto ke WebP lalu simpan. Bila satu gagal, berkas yang sudah tertulis dihapus. */
export async function storePortfolioPhotos(db: Db, photos: IncomingPhoto[], texts: PortfolioPhotoText[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
	if (photos.length !== texts.length) return { ok: false, error: 'Isi teks alternatif untuk setiap foto.' };
	const store = getStore();
	const saved: string[] = [];
	try {
		for (const photo of photos) {
			let webp: Uint8Array;
			try {
				webp = await compressToWebp(photo.bytes);
			} catch {
				throw new Error(COMPRESS_MESSAGE);
			}
			if (webp.byteLength > PORTFOLIO_MAX_BYTES) throw new Error(COMPRESS_MESSAGE);
			saved.push(await saveImage(store, webp, { ext: 'webp', mime: 'image/webp' }));
		}
		await addPortfolioPhotos(db, saved.map((image, i) => ({ image, alt: texts[i].alt, caption: texts[i].caption })));
		return { ok: true, count: saved.length };
	} catch (err) {
		await Promise.all(saved.map((path) => cleanup(store, path)));
		if (err instanceof Error && err.message === COMPRESS_MESSAGE) return { ok: false, error: COMPRESS_MESSAGE };
		throw err;
	}
}
