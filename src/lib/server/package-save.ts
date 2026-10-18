import type { PackageValues } from '#lib/package-form.js';
import type { Package } from '#lib/types.js';
import type { Db } from './db';
import { createPackage, updatePackage } from './packages.js';
import { deleteUpload, detectImageType, MAX_UPLOAD_BYTES, saveImage, uploadDir, type ImageType } from './uploads.js';

export const PHOTO_TYPE_MESSAGE = 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.';
export const PHOTO_SIZE_MESSAGE = 'Foto terlalu besar. Maksimal 5 MB.';
export const PHOTO_EMPTY_MESSAGE = 'Berkas foto kosong. Pilih foto lain.';

export type PhotoInput =
	| { kind: 'none' }
	| { kind: 'new'; bytes: Uint8Array; type: ImageType }
	| { kind: 'error'; message: string };

/**
 * Baca isian berkas `photo`. Tidak menulis apa pun ke disk: jenis ditentukan dari isi berkas
 * dan ukuran diperiksa sebelum isi dibaca, sehingga penolakan tidak meninggalkan berkas.
 */
export async function readPhoto(form: { get(name: string): unknown }): Promise<PhotoInput> {
	const file = form.get('photo');
	if (!(file instanceof File)) return { kind: 'none' };
	// Tanpa pilihan, peramban mengirim berkas kosong tanpa nama.
	if (file.size === 0) return file.name ? { kind: 'error', message: PHOTO_EMPTY_MESSAGE } : { kind: 'none' };
	if (file.size > MAX_UPLOAD_BYTES) return { kind: 'error', message: PHOTO_SIZE_MESSAGE };
	const bytes = new Uint8Array(await file.arrayBuffer());
	const type = detectImageType(bytes);
	return type ? { kind: 'new', bytes, type } : { kind: 'error', message: PHOTO_TYPE_MESSAGE };
}

/**
 * Buat paket draft (+ foto). Masukan sudah divalidasi pemanggil. Berkas ditulis dahulu,
 * lalu database; bila database gagal berkas baru dihapus lagi agar tidak ada berkas yatim.
 */
export function createWithPhoto(db: Db, values: PackageValues, photo: PhotoInput, dir: string = uploadDir()): Package {
	const image = photo.kind === 'new' ? saveImage(photo.bytes, photo.type, dir) : null;
	try {
		return createPackage(db, values, image);
	} catch (err) {
		deleteUpload(image, dir);
		throw err;
	}
}

export type EditOptions = { photo: PhotoInput; removePhoto: boolean };

/**
 * Simpan perubahan paket. Foto baru menggantikan yang lama (berkas lama dihapus setelah
 * database berhasil); "Hapus foto" mengosongkan `image`. Foto bawaan (`/media/…`) tidak pernah dihapus.
 */
export function editWithPhoto(db: Db, id: number, values: PackageValues, opts: EditOptions, dir: string = uploadDir()): boolean {
	const added = opts.photo.kind === 'new' ? saveImage(opts.photo.bytes, opts.photo.type, dir) : null;
	const image = added ?? (opts.removePhoto ? null : undefined);
	let result;
	try {
		result = updatePackage(db, id, values, image);
	} catch (err) {
		deleteUpload(added, dir);
		throw err;
	}
	if (!result.ok) {
		deleteUpload(added, dir);
		return false;
	}
	if (image !== undefined) deleteUpload(result.previousImage, dir);
	return true;
}
