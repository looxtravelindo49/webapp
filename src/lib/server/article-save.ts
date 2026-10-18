import type { ArticleValues } from '#lib/article-form.js';
import type { Article } from '#lib/types.js';
import { createArticle, getArticle, updateArticle, type UnsplashCover } from './articles.js';
import type { Db } from './db';
import type { PhotoInput } from './package-save.js';
import { deleteUpload, getStore, isUploadPath, saveImage, type ImageStore } from './uploads.js';
import { getUnsplash, UnsplashError, type Photo, type Unsplash } from './unsplash.js';

export const COVER_CONFLICT_MESSAGE = 'Pilih salah satu: unggah foto atau pakai foto Unsplash.';
const UNSPLASH_MESSAGES = {
	'not-found': 'Foto Unsplash tidak ditemukan. Pilih foto lain.',
	'rate-limited': 'Jatah Unsplash sedang habis. Coba lagi nanti atau unggah foto sendiri.',
	unavailable: 'Unsplash tidak dapat dihubungi. Coba lagi nanti atau unggah foto sendiri.',
	'not-configured': 'Pemilih foto Unsplash belum diaktifkan.',
	invalid: 'Foto Unsplash tidak valid. Pilih foto lagi.'
} as const;

/** Galat sampul yang pesannya boleh ditampilkan langsung pada isian foto; tidak ada data yang berubah. */
export class CoverError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CoverError';
	}
}

/** Ambil foto dari API (data tepercaya); galat Unsplash menjadi `CoverError` berpesan jelas. */
async function fetchPhoto(unsplash: Unsplash, id: string): Promise<Photo> {
	try {
		return await unsplash.getPhoto(id);
	} catch (err) {
		throw new CoverError(UNSPLASH_MESSAGES[err instanceof UnsplashError ? err.kind : 'unavailable']);
	}
}

const creditOf = (photo: Photo): UnsplashCover => ({ id: photo.id, name: photo.name, url: photo.profile });

/** Hapus berkas tanpa menutupi galat asli (pembersihan gagal hanya dicatat). */
const cleanup = (store: ImageStore, path: string | null | undefined) =>
	deleteUpload(store, path).catch((err) => console.error('[uploads] gagal menghapus', path, err));

/**
 * Buat artikel draf (+ sampul). Masukan sudah divalidasi pemanggil. Sampul bisa berkas unggahan ATAU foto
 * Unsplash (`unsplashId`), tidak keduanya. Berkas ditulis dahulu, lalu database; bila database gagal berkas baru
 * dihapus lagi agar tidak ada berkas yatim. Foto Unsplash diambil dari API sebelum apa pun ditulis, dan unduhannya
 * dilaporkan setelah artikel berhasil disimpan. Penyimpanan dibuka hanya bila dibutuhkan.
 * @throws CoverError bila sampul tidak dapat dipakai (tidak ada data yang berubah)
 */
export async function createArticleWithCover(
	db: Db,
	values: ArticleValues,
	photo: PhotoInput,
	store?: ImageStore,
	unsplashId?: string | null,
	unsplash?: Unsplash
): Promise<Article> {
	if (unsplashId) {
		if (photo.kind === 'new') throw new CoverError(COVER_CONFLICT_MESSAGE);
		const client = unsplash ?? getUnsplash();
		const picked = await fetchPhoto(client, unsplashId);
		const article = await createArticle(db, values, picked.raw, creditOf(picked));
		await client.trackDownload(picked.downloadLocation);
		return article;
	}
	if (photo.kind !== 'new') return createArticle(db, values, null);
	const s = store ?? getStore();
	const cover = await saveImage(s, photo.bytes, photo.type);
	try {
		return await createArticle(db, values, cover);
	} catch (err) {
		await cleanup(s, cover);
		throw err;
	}
}

export type EditOptions = { photo: PhotoInput; removePhoto: boolean; unsplashId?: string | null };

/**
 * Simpan perubahan artikel. Sampul baru (unggahan atau foto Unsplash) menggantikan yang lama; berkas unggahan
 * lama dihapus setelah database berhasil. "Hapus foto" mengosongkan sampul beserta kredit Unsplash; foto baru
 * lebih diutamakan daripada "Hapus foto". Gambar bawaan (`/media/…`) tidak pernah dihapus. Memilih foto Unsplash
 * yang sama dengan yang tersimpan tidak mengubah apa pun dan tidak memanggil Unsplash.
 * Mengembalikan false bila artikel tidak ada.
 * @throws CoverError bila sampul tidak dapat dipakai (tidak ada data yang berubah)
 */
export async function editArticleWithCover(
	db: Db,
	id: number,
	values: ArticleValues,
	opts: EditOptions,
	store?: ImageStore,
	unsplash?: Unsplash
): Promise<boolean> {
	if (opts.unsplashId && opts.photo.kind === 'new') throw new CoverError(COVER_CONFLICT_MESSAGE);

	let picked: Photo | null = null;
	let client: Unsplash | undefined;
	if (opts.unsplashId) {
		const current = await getArticle(db, id);
		if (!current) return false;
		if (current.cover_unsplash_id !== opts.unsplashId) {
			client = unsplash ?? getUnsplash();
			picked = await fetchPhoto(client, opts.unsplashId);
		}
	}

	let s = store;
	const storage = () => (s ??= getStore());
	const added = opts.photo.kind === 'new' ? await saveImage(storage(), opts.photo.bytes, opts.photo.type) : null;
	// Sampul Unsplash yang sama (tidak diambil ulang) berarti sampul dibiarkan, bukan dihapus.
	const keepSame = !!opts.unsplashId && picked === null;
	const cover = added ?? picked?.raw ?? (opts.removePhoto && !keepSame ? null : undefined);
	let result;
	try {
		result = await updateArticle(db, id, values, cover, picked ? creditOf(picked) : null);
	} catch (err) {
		if (added) await cleanup(storage(), added);
		throw err;
	}
	if (!result.ok) {
		if (added) await cleanup(storage(), added);
		return false;
	}
	if (cover !== undefined && isUploadPath(result.previousCover)) await cleanup(storage(), result.previousCover);
	if (picked && client) await client.trackDownload(picked.downloadLocation);
	return true;
}
