import type { PackageValues } from '#lib/package-form.js';
import type { Package } from '#lib/types.js';
import type { Db } from './db';
import { createPackage, updatePackage } from './packages.js';
import { deleteUpload, detectImageType, getStore, isUploadPath, MAX_UPLOAD_BYTES, saveImage, type ImageStore, type ImageType } from './uploads.js';

export const PHOTO_TYPE_MESSAGE = 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.';
export const PHOTO_SIZE_MESSAGE = 'Foto terlalu besar. Maksimal 4 MB.';
export const PHOTO_EMPTY_MESSAGE = 'Berkas foto kosong. Pilih foto lain.';

export type PhotoInput =
	| { kind: 'none' }
	| { kind: 'new'; bytes: Uint8Array; type: ImageType }
	| { kind: 'error'; message: string };

/**
 * Baca isian berkas. Bawaan `photo` (foto utama). Galeri memakai nama lain, mis. `gallery_photo`.
 * Tidak menulis apa pun ke penyimpanan: jenis ditentukan dari isi berkas
 * dan ukuran diperiksa sebelum isi dibaca, sehingga penolakan tidak meninggalkan berkas.
 */
export async function readPhoto(form: { get(name: string): unknown }, field = 'photo'): Promise<PhotoInput> {
	const file = form.get(field);
	if (!(file instanceof File)) return { kind: 'none' };
	// Tanpa pilihan, peramban mengirim berkas kosong tanpa nama.
	if (file.size === 0) return file.name ? { kind: 'error', message: PHOTO_EMPTY_MESSAGE } : { kind: 'none' };
	if (file.size > MAX_UPLOAD_BYTES) return { kind: 'error', message: PHOTO_SIZE_MESSAGE };
	const bytes = new Uint8Array(await file.arrayBuffer());
	const type = detectImageType(bytes);
	return type ? { kind: 'new', bytes, type } : { kind: 'error', message: PHOTO_TYPE_MESSAGE };
}

/** Hapus berkas tanpa menutupi galat asli (pembersihan gagal hanya dicatat). */
const cleanup = (store: ImageStore, path: string | null | undefined) =>
	deleteUpload(store, path).catch((err) => console.error('[uploads] gagal menghapus', path, err));

/**
 * Buat paket draft (+ foto). Masukan sudah divalidasi pemanggil. Berkas ditulis dahulu,
 * lalu database; bila database gagal berkas baru dihapus lagi agar tidak ada berkas yatim.
 * Penyimpanan dibuka hanya bila dibutuhkan, jadi simpan tanpa foto tidak bergantung padanya.
 */
export async function createWithPhoto(db: Db, values: PackageValues, photo: PhotoInput, store?: ImageStore): Promise<Package> {
	if (photo.kind !== 'new') return createPackage(db, values, null);
	const s = store ?? getStore();
	const image = await saveImage(s, photo.bytes, photo.type);
	try {
		return await createPackage(db, values, image);
	} catch (err) {
		await cleanup(s, image);
		throw err;
	}
}

export type EditOptions = { photo: PhotoInput; removePhoto: boolean };

/**
 * Simpan perubahan paket. Foto baru menggantikan yang lama (berkas lama dihapus setelah
 * database berhasil); "Hapus foto" mengosongkan `image`. Foto bawaan (`/media/…`) tidak pernah dihapus.
 */
export async function editWithPhoto(db: Db, id: number, values: PackageValues, opts: EditOptions, store?: ImageStore): Promise<boolean> {
	let s = store;
	const storage = () => (s ??= getStore());
	const added = opts.photo.kind === 'new' ? await saveImage(storage(), opts.photo.bytes, opts.photo.type) : null;
	const image = added ?? (opts.removePhoto ? null : undefined);
	let result;
	try {
		result = await updatePackage(db, id, values, image);
	} catch (err) {
		if (added) await cleanup(storage(), added);
		throw err;
	}
	if (!result.ok) {
		if (added) await cleanup(storage(), added);
		return false;
	}
	if (image !== undefined && isUploadPath(result.previousImage)) await cleanup(storage(), result.previousImage);
	return true;
}
