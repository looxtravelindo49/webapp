import { BlobNotFoundError, del, get as blobGet, head, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/** 4 MB: di bawah batas badan permintaan fungsi serverless Vercel (4,5 MB) termasuk overhead multipart. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

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

// ---------------------------------------------------------------------------
// Penyimpanan: berkas di disk (pengembangan, e2e, kontainer) atau Vercel Blob (serverless).
// Kunci selalu nama berpola `<uuid>.<ext>`; path publik `/uploads/<nama>` tidak bergantung pada penyimpanan.
// ---------------------------------------------------------------------------

export type StoredImage = { body: Uint8Array | ReadableStream<Uint8Array> };

export interface ImageStore {
	/** Simpan; melempar bila nama sudah ada (nama acak, tidak pernah ditimpa). */
	put(name: string, bytes: Uint8Array, mime: string): Promise<void>;
	/** Isi berkas, atau null bila tidak ada. */
	get(name: string): Promise<StoredImage | null>;
	/** Hapus; true bila berkas ada dan terhapus. */
	delete(name: string): Promise<boolean>;
}

const isMissing = (err: unknown) => (err as NodeJS.ErrnoException)?.code === 'ENOENT';

/** Penyimpanan di folder disk. Nama yang tidak berpola ditolak di sini juga (lapis kedua melawan traversal). */
export class FsStore implements ImageStore {
	constructor(readonly dir: string) {}

	private file(name: string): string {
		if (!UPLOAD_NAME.test(name)) throw new Error(`Nama unggahan tidak valid: ${name}`);
		return join(this.dir, name);
	}

	async put(name: string, bytes: Uint8Array): Promise<void> {
		const file = this.file(name);
		await mkdir(this.dir, { recursive: true });
		await writeFile(file, bytes, { flag: 'wx' });
	}

	async get(name: string): Promise<StoredImage | null> {
		if (!UPLOAD_NAME.test(name)) return null;
		try {
			return { body: await readFile(join(this.dir, name)) };
		} catch (err) {
			if (isMissing(err)) return null;
			throw err;
		}
	}

	async delete(name: string): Promise<boolean> {
		if (!UPLOAD_NAME.test(name)) return false;
		try {
			await unlink(join(this.dir, name));
			return true;
		} catch (err) {
			if (isMissing(err)) return false;
			throw err;
		}
	}
}

/** Bagian API `@vercel/blob` yang dipakai, supaya bisa diganti klien palsu pada tes. */
export type BlobClient = Pick<typeof import('@vercel/blob'), 'put' | 'get' | 'head' | 'del'>;
const vercelBlob: BlobClient = { put, get: blobGet, head, del };

/** Penyimpanan di Vercel Blob (store privat): pathname `uploads/<nama>`, tanpa suffix acak, tanpa URL publik. */
export class BlobStore implements ImageStore {
	constructor(
		private readonly token: string,
		private readonly client: BlobClient = vercelBlob
	) {}

	private path(name: string): string {
		if (!UPLOAD_NAME.test(name)) throw new Error(`Nama unggahan tidak valid: ${name}`);
		return `uploads/${name}`;
	}

	async put(name: string, bytes: Uint8Array, mime: string): Promise<void> {
		await this.client.put(this.path(name), Buffer.from(bytes), {
			access: 'private',
			addRandomSuffix: false,
			allowOverwrite: false,
			contentType: mime,
			token: this.token
		});
	}

	async get(name: string): Promise<StoredImage | null> {
		if (!UPLOAD_NAME.test(name)) return null;
		const found = await this.client.get(this.path(name), { access: 'private', token: this.token });
		if (!found || found.statusCode !== 200) return null;
		return { body: found.stream };
	}

	async delete(name: string): Promise<boolean> {
		if (!UPLOAD_NAME.test(name)) return false;
		try {
			await this.client.head(this.path(name), { token: this.token });
		} catch (err) {
			if (err instanceof BlobNotFoundError) return false;
			throw err;
		}
		await this.client.del(this.path(name), { token: this.token });
		return true;
	}
}

/**
 * Penyimpanan aktif: Vercel Blob bila `BLOB_READ_WRITE_TOKEN` ada, selain itu folder disk.
 * Di Vercel tanpa token melempar galat (disk fungsi tidak persisten).
 */
export function getStore(env: Record<string, string | undefined> = process.env): ImageStore {
	if (env.BLOB_READ_WRITE_TOKEN) return new BlobStore(env.BLOB_READ_WRITE_TOKEN);
	if (env.VERCEL) throw new Error('BLOB_READ_WRITE_TOKEN wajib diset di Vercel untuk menyimpan foto unggahan.');
	return new FsStore(uploadDir(env));
}

/** Simpan gambar dengan nama acak; mengembalikan path publik `/uploads/<nama>`. */
export async function saveImage(store: ImageStore, bytes: Uint8Array, type: ImageType): Promise<string> {
	const name = `${randomUUID()}.${type.ext}`;
	await store.put(name, bytes, type.mime);
	return `/uploads/${name}`;
}

/** Path publik `/uploads/<nama berpola>` (satu-satunya bentuk yang kita hasilkan sendiri). */
export const isUploadPath = (path: string | null | undefined): path is string => !!path && UPLOAD_PATH.test(path);

/** Foto yang lolos pemeriksaan jenis dan ukuran, siap dikompresi. */
export async function readPhotoReady(form: { get(name: string): unknown }, field = 'photo'): Promise<{ kind: 'none' } | { kind: 'new'; bytes: Uint8Array } | { kind: 'error'; message: string }> {
	const file = form.get(field);
	if (!(file instanceof File)) return { kind: 'none' };
	if (file.size === 0) return file.name ? { kind: 'error', message: 'Berkas foto kosong. Pilih foto lain.' } : { kind: 'none' };
	if (file.size > MAX_UPLOAD_BYTES) return { kind: 'error', message: 'Foto terlalu besar. Maksimal 4 MB.' };
	const bytes = new Uint8Array(await file.arrayBuffer());
	return detectImageType(bytes) ? { kind: 'new', bytes } : { kind: 'error', message: 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.' };
}

/** Hapus berkas unggahan; path lain (mis. `/media/…`) diabaikan. Mengembalikan true bila berkas terhapus. */
export async function deleteUpload(store: ImageStore, path: string | null | undefined): Promise<boolean> {
	const m = path ? UPLOAD_PATH.exec(path) : null;
	return m ? store.delete(m[1]) : false;
}
