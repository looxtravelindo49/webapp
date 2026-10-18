import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Nama berkas unggahan yang kita buat sendiri: UUID huruf kecil + ekstensi dari jenis terdeteksi. */
export const UPLOAD_NAME = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:jpg|png|webp|avif)$/;
const UPLOAD_PATH = /^\/uploads\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:jpg|png|webp|avif))$/;

export type ImageExt = 'jpg' | 'png' | 'webp' | 'avif';
export type ImageType = { ext: ImageExt; mime: string };

const MIME: Record<ImageExt, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };
export const mimeForName = (name: string): string | null => MIME[name.slice(name.lastIndexOf('.') + 1) as ImageExt] ?? null;

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/**
 * Jenis gambar dari ISI berkas (byte awal), bukan nama atau Content-Type klien.
 * JPEG, PNG, WebP, dan AVIF saja; SVG, GIF, dan lainnya → null.
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', mime: MIME.jpg };
	if (
		bytes.length >= 8 &&
		[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => bytes[i] === v)
	) {
		return { ext: 'png', mime: MIME.png };
	}
	if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { ext: 'webp', mime: MIME.webp };
	if (bytes.length >= 16 && ascii(bytes, 4, 8) === 'ftyp') {
		// Kotak ftyp: [ukuran 4][ftyp][brand utama 4][versi minor 4][brand kompatibel 4 …]
		const size = Math.min(((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0, bytes.length, 64);
		const brands = [ascii(bytes, 8, 12)];
		for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(bytes, i, i + 4));
		if (brands.some((b) => b === 'avif' || b === 'avis')) return { ext: 'avif', mime: MIME.avif };
	}
	return null;
}

/** Folder unggahan: `UPLOAD_DIR`, atau `uploads` di samping berkas database. */
export function uploadDir(env: Record<string, string | undefined> = process.env): string {
	return env.UPLOAD_DIR ? resolve(env.UPLOAD_DIR) : join(dirname(resolve(env.DATABASE_PATH || './data/app.db')), 'uploads');
}

/** Simpan gambar dengan nama acak; mengembalikan path publik `/uploads/<nama>`. */
export function saveImage(bytes: Uint8Array, type: ImageType, dir: string = uploadDir()): string {
	mkdirSync(dir, { recursive: true });
	const name = `${randomUUID()}.${type.ext}`;
	writeFileSync(join(dir, name), bytes, { flag: 'wx' });
	return `/uploads/${name}`;
}

/** Path publik `/uploads/<nama berpola>` (satu-satunya bentuk yang kita hasilkan sendiri). */
export const isUploadPath = (path: string | null | undefined): path is string => !!path && UPLOAD_PATH.test(path);

/** Lokasi berkas di disk untuk nama berpola; null bila nama tidak berpola (menutup traversal). */
export function uploadFile(name: string, dir: string = uploadDir()): string | null {
	return UPLOAD_NAME.test(name) ? join(dir, name) : null;
}

/** Hapus berkas unggahan; path lain (mis. `/media/…`) diabaikan. Mengembalikan true bila berkas terhapus. */
export function deleteUpload(path: string | null | undefined, dir: string = uploadDir()): boolean {
	const m = path ? UPLOAD_PATH.exec(path) : null;
	if (!m) return false;
	const file = join(dir, m[1]);
	if (!existsSync(file)) return false;
	unlinkSync(file);
	return true;
}
