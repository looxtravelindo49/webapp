import type { PortfolioValues } from '#lib/portfolio-form.js';
import type { Db } from './db';
import { compressToWebp, PORTFOLIO_MAX_BYTES } from './image-compress.js';
import { createPortfolio, getPortfolio, updatePortfolio, type PortfolioItem } from './portfolio.js';
import { deleteUpload, getStore, saveImage, type ImageStore } from './uploads.js';

export const COMPRESS_MESSAGE = 'Foto tidak bisa dikompresi. Pilih JPEG, PNG, WebP, atau AVIF lain.';

const cleanup = (store: ImageStore, path: string | null | undefined) =>
	deleteUpload(store, path).catch((err) => console.error('[uploads] gagal menghapus', path, err));

async function storedWebp(bytes: Uint8Array): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
	let webp: Uint8Array;
	try {
		webp = await compressToWebp(bytes);
	} catch {
		return { ok: false, message: COMPRESS_MESSAGE };
	}
	if (webp.byteLength > PORTFOLIO_MAX_BYTES) return { ok: false, message: COMPRESS_MESSAGE };
	const path = await saveImage(getStore(), webp, { ext: 'webp', mime: 'image/webp' });
	return { ok: true, path };
}

export async function createPortfolioItem(db: Db, values: PortfolioValues, photo: { kind: 'none' } | { kind: 'new'; bytes: Uint8Array }): Promise<PortfolioItem | { error: string }> {
	let image: string | null = null;
	if (photo.kind === 'new') {
		const saved = await storedWebp(photo.bytes);
		if (!saved.ok) return { error: saved.message };
		image = saved.path;
	}
	try {
		return await createPortfolio(db, values, image);
	} catch (err) {
		await cleanup(getStore(), image);
		throw err;
	}
}

/**
 * Perbarui teks dan, bila ada, foto. `remove` menghapus foto lama bila tidak diganti.
 * Mengembalikan path yang boleh dihapus dari penyimpanan setelah baris tersimpan.
 */
export async function savePortfolioItem(
	db: Db,
	id: number,
	values: PortfolioValues,
	photo: { kind: 'none' } | { kind: 'new'; bytes: Uint8Array }
): Promise<{ ok: true; dropped: string | null } | { ok: false; error: string }> {
	const current = await getPortfolio(db, id);
	if (!current) return { ok: false, error: 'Dokumentasi tidak ditemukan.' };
	let image = values.removePhoto ? null : current.image;
	let created: string | null = null;
	if (photo.kind === 'new') {
		const saved = await storedWebp(photo.bytes);
		if (!saved.ok) return { ok: false, error: saved.message };
		created = saved.path;
		image = saved.path;
	}
	try {
		const saved = await updatePortfolio(db, id, values, image);
		if (!saved) {
			await cleanup(getStore(), created);
			return { ok: false, error: 'Dokumentasi tidak ditemukan.' };
		}
	} catch (err) {
		await cleanup(getStore(), created);
		throw err;
	}
	const dropped = created || values.removePhoto ? current.image : null;
	return { ok: true, dropped: dropped && dropped !== image ? dropped : null };
}
