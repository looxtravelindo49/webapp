import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { BlobNotFoundError } from '@vercel/blob';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	BlobStore, FsStore, MAX_UPLOAD_BYTES, UPLOAD_NAME, deleteUpload, detectImageType, getStore, isUploadPath, mimeForName,
	saveImage, uploadDir, type BlobClient, type ImageStore
} from './uploads';

const dirs: string[] = [];
const tmp = () => {
	const d = mkdtempSync(join(tmpdir(), 'lembang-up-'));
	dirs.push(d);
	return d;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const bytes = (...v: number[]) => new Uint8Array(v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16);
const WEBP = bytes(...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBP'), ...ascii('VP8 '));
const ftyp = (major: string, ...compat: string[]) => {
	const size = 16 + compat.length * 4;
	return bytes(0, 0, 0, size, ...ascii('ftyp'), ...ascii(major), 0, 0, 0, 0, ...compat.flatMap(ascii));
};
const AVIF = ftyp('avif', 'mif1', 'avif');

describe('detectImageType', () => {
	it.each([
		['JPEG', JPEG, 'jpg', 'image/jpeg'],
		['PNG', PNG, 'png', 'image/png'],
		['WebP', WEBP, 'webp', 'image/webp'],
		['AVIF (brand utama avif)', AVIF, 'avif', 'image/avif'],
		['AVIF (avis)', ftyp('avis'), 'avif', 'image/avif'],
		['AVIF (brand kompatibel saja)', ftyp('mif1', 'miaf', 'avif'), 'avif', 'image/avif']
	])('%s', (_n, data, ext, mime) => expect(detectImageType(data)).toEqual({ ext, mime }));

	it.each([
		['SVG', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
		['SVG dengan XML', new TextEncoder().encode('<?xml version="1.0"?><svg/>')],
		['GIF', new TextEncoder().encode('GIF89a......')],
		['teks biasa', new TextEncoder().encode('ini bukan gambar sama sekali')],
		['HEIC', ftyp('heic', 'mif1')],
		['MP4', ftyp('isom', 'iso2', 'mp41')],
		['RIFF bukan WebP (WAV)', bytes(...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WAVE'))],
		['PNG terpotong', bytes(0x89, 0x50, 0x4e, 0x47)],
		['kosong', bytes()],
		['HTML', new TextEncoder().encode('<html><script>alert(1)</script>')],
		['PDF', new TextEncoder().encode('%PDF-1.7')]
	])('menolak %s', (_n, data) => expect(detectImageType(data)).toBeNull());

	it('ftyp dengan ukuran kotak palsu tidak membaca di luar data', () => {
		const lying = bytes(0xff, 0xff, 0xff, 0xff, ...ascii('ftyp'), ...ascii('mif1'), 0, 0, 0, 0);
		expect(detectImageType(lying)).toBeNull();
	});
});

describe('uploadDir', () => {
	it('memakai UPLOAD_DIR bila diset', () => {
		expect(uploadDir({ UPLOAD_DIR: '/tmp/foto' })).toBe('/tmp/foto');
	});
	it('bawaan: folder uploads di samping berkas database', () => {
		expect(uploadDir({ DATABASE_PATH: '/tmp/x/app.db' })).toBe('/tmp/x/uploads');
		expect(uploadDir({ DATABASE_PATH: '/data/app.db' })).toBe('/data/uploads');
	});
	it('tanpa env memakai ./data/uploads', () => {
		expect(uploadDir({})).toMatch(/data\/uploads$/);
	});
});

describe('getStore', () => {
	it('Blob bila BLOB_READ_WRITE_TOKEN ada, apa pun lainnya', () => {
		expect(getStore({ BLOB_READ_WRITE_TOKEN: 't', UPLOAD_DIR: '/tmp/x' })).toBeInstanceOf(BlobStore);
		expect(getStore({ BLOB_READ_WRITE_TOKEN: 't', VERCEL: '1' })).toBeInstanceOf(BlobStore);
	});
	it('folder disk tanpa token (UPLOAD_DIR atau bawaan di samping database)', () => {
		const a = getStore({ UPLOAD_DIR: '/tmp/foto' });
		expect(a).toBeInstanceOf(FsStore);
		expect((a as FsStore).dir).toBe('/tmp/foto');
		expect((getStore({ DATABASE_PATH: '/tmp/x/app.db' }) as FsStore).dir).toBe('/tmp/x/uploads');
	});
	it('di Vercel tanpa token melempar galat yang menyebut BLOB_READ_WRITE_TOKEN', () => {
		expect(() => getStore({ VERCEL: '1', UPLOAD_DIR: '/tmp/x' })).toThrow(/BLOB_READ_WRITE_TOKEN/);
	});
});

describe('saveImage', () => {
	it('menyimpan dengan nama UUID + ekstensi dari jenis terdeteksi dan membuat folder', async () => {
		const dir = join(tmp(), 'belum', 'ada');
		const path = await saveImage(new FsStore(dir), PNG, detectImageType(PNG)!);
		expect(path).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
		const name = path.replace('/uploads/', '');
		expect(UPLOAD_NAME.test(name)).toBe(true);
		expect(readFileSync(join(dir, name))).toEqual(Buffer.from(PNG));
		expect(readdirSync(dir)).toEqual([name]);
	});

	it('nama unik untuk setiap unggahan', async () => {
		const dir = tmp();
		const store = new FsStore(dir);
		const a = await saveImage(store, JPEG, detectImageType(JPEG)!);
		const b = await saveImage(store, JPEG, detectImageType(JPEG)!);
		expect(a).not.toBe(b);
		expect(readdirSync(dir)).toHaveLength(2);
	});

	it('ekstensi mengikuti isi, bukan nama asli (tidak pernah dipakai)', async () => {
		const store = new FsStore(tmp());
		expect((await saveImage(store, PNG, detectImageType(PNG)!)).endsWith('.png')).toBe(true);
		expect((await saveImage(store, AVIF, detectImageType(AVIF)!)).endsWith('.avif')).toBe(true);
		expect((await saveImage(store, WEBP, detectImageType(WEBP)!)).endsWith('.webp')).toBe(true);
		expect((await saveImage(store, JPEG, detectImageType(JPEG)!)).endsWith('.jpg')).toBe(true);
	});

	it('tidak menulis di luar folder unggahan', async () => {
		const root = tmp();
		await saveImage(new FsStore(join(root, 'uploads')), PNG, detectImageType(PNG)!);
		expect(readdirSync(root)).toEqual(['uploads']);
	});
});

describe('isUploadPath / mimeForName', () => {
	const good = '0b6f3c1e-9d2a-4f7b-8c10-1a2b3c4d5e6f';
	it.each([`/uploads/${good}.png`, `/uploads/${good}.jpg`, `/uploads/${good}.webp`, `/uploads/${good}.avif`])('menerima %s', (p) =>
		expect(isUploadPath(p)).toBe(true)
	);
	it.each([
		'/media/forest.svg',
		`/uploads/${good}.svg`,
		`/uploads/${good}.gif`,
		`/uploads/${good.toUpperCase()}.png`,
		'/uploads/foto.png',
		`/uploads/../${good}.png`,
		`/uploads/${good}.png/extra`,
		`/uploads//${good}.png`,
		`uploads/${good}.png`,
		'',
		null,
		undefined
	])('menolak %j', (p) => expect(isUploadPath(p as string)).toBe(false));

	it('mimeForName', () => {
		expect(mimeForName(`${good}.jpg`)).toBe('image/jpeg');
		expect(mimeForName(`${good}.avif`)).toBe('image/avif');
		expect(mimeForName(`${good}.svg`)).toBeNull();
	});
});

describe('deleteUpload', () => {
	it('menghapus berkas unggahan yang ada', async () => {
		const dir = tmp();
		const store = new FsStore(dir);
		const path = await saveImage(store, PNG, detectImageType(PNG)!);
		expect(await deleteUpload(store, path)).toBe(true);
		expect(readdirSync(dir)).toEqual([]);
	});
	it('mengabaikan path di luar /uploads/ (mis. foto statis) dan berkas yang tidak ada', async () => {
		const dir = tmp();
		const store = new FsStore(dir);
		writeFileSync(join(dir, 'forest.svg'), 'x');
		expect(await deleteUpload(store, '/media/forest.svg')).toBe(false);
		expect(await deleteUpload(store, '/uploads/forest.svg')).toBe(false);
		expect(await deleteUpload(store, '/uploads/0b6f3c1e-9d2a-4f7b-8c10-1a2b3c4d5e6f.png')).toBe(false);
		expect(await deleteUpload(store, null)).toBe(false);
		expect(existsSync(join(dir, 'forest.svg'))).toBe(true);
	});
	it('tidak bisa menghapus berkas lain lewat traversal', async () => {
		const root = tmp();
		const store = new FsStore(join(root, 'uploads'));
		await saveImage(store, PNG, detectImageType(PNG)!);
		writeFileSync(join(root, 'penting.png'), 'x');
		expect(await deleteUpload(store, '/uploads/../penting.png')).toBe(false);
		expect(existsSync(join(root, 'penting.png'))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Kontrak ImageStore: dijalankan terhadap FsStore (disk) dan BlobStore (klien Blob palsu).
// ---------------------------------------------------------------------------

type FakeCall = { op: string; path: string; opts?: Record<string, unknown> };

/** Klien Blob palsu di memori yang meniru perilaku yang dipakai: put, get, head, del. */
function fakeBlob() {
	const blobs = new Map<string, Uint8Array>();
	const calls: FakeCall[] = [];
	const client = {
		put: async (path: string, body: Buffer, opts: Record<string, unknown>) => {
			calls.push({ op: 'put', path, opts });
			if (blobs.has(path) && !opts.allowOverwrite) throw new Error('This blob already exists');
			blobs.set(path, new Uint8Array(body));
			return { pathname: path };
		},
		get: async (path: string, opts: Record<string, unknown>) => {
			calls.push({ op: 'get', path, opts });
			const bytes = blobs.get(path);
			if (!bytes) return null;
			return { statusCode: 200, stream: new Blob([bytes as BlobPart]).stream(), headers: new Headers(), blob: {} };
		},
		head: async (path: string, opts: Record<string, unknown>) => {
			calls.push({ op: 'head', path, opts });
			if (!blobs.has(path)) throw new BlobNotFoundError();
			return { pathname: path };
		},
		del: async (path: string, opts: Record<string, unknown>) => {
			calls.push({ op: 'del', path, opts });
			blobs.delete(path);
		}
	};
	return { client: client as unknown as BlobClient, blobs, calls };
}

const read = async (found: { body: Uint8Array | ReadableStream<Uint8Array> } | null) =>
	found ? new Uint8Array(await new Response(found.body as BodyInit).arrayBuffer()) : null;

const ID = '0b6f3c1e-9d2a-4f7b-8c10-1a2b3c4d5e6f';

describe.each<[string, () => ImageStore]>([
	['FsStore', () => new FsStore(join(tmp(), 'uploads'))],
	['BlobStore', () => new BlobStore('token-uji', fakeBlob().client)]
])('kontrak ImageStore: %s', (_name, make) => {
	it('simpan lalu ambil mengembalikan isi yang sama', async () => {
		const store = make();
		await store.put(`${ID}.png`, PNG, 'image/png');
		expect(await read(await store.get(`${ID}.png`))).toEqual(PNG);
	});
	it('mengambil yang tidak ada → null', async () => {
		expect(await make().get(`${ID}.png`)).toBeNull();
	});
	it('hapus: true bila ada, false bila tidak ada, lalu tidak bisa diambil lagi', async () => {
		const store = make();
		expect(await store.delete(`${ID}.png`)).toBe(false);
		await store.put(`${ID}.png`, PNG, 'image/png');
		expect(await store.delete(`${ID}.png`)).toBe(true);
		expect(await store.get(`${ID}.png`)).toBeNull();
		expect(await store.delete(`${ID}.png`)).toBe(false);
	});
	it('tidak menimpa nama yang sudah ada', async () => {
		const store = make();
		await store.put(`${ID}.png`, PNG, 'image/png');
		await expect(store.put(`${ID}.png`, JPEG, 'image/png')).rejects.toThrow();
		expect(await read(await store.get(`${ID}.png`))).toEqual(PNG);
	});
	it('menolak nama tidak berpola: put melempar, get null, delete false', async () => {
		const store = make();
		for (const bad of ['../x.png', 'foto.png', `${ID}.svg`, `${ID}.png/..`, '']) {
			await expect(store.put(bad, PNG, 'image/png'), bad).rejects.toThrow();
			expect(await store.get(bad), bad).toBeNull();
			expect(await store.delete(bad), bad).toBe(false);
		}
	});
});

describe('path publik tidak bergantung penyimpanan', () => {
	it('folder dan Blob menghasilkan bentuk /uploads/<uuid>.<ext> yang sama, jadi nilai kolom image portabel', async () => {
		const pattern = /^\/uploads\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.png$/;
		const viaFs = await saveImage(new FsStore(tmp()), PNG, detectImageType(PNG)!);
		const viaBlob = await saveImage(new BlobStore('t', fakeBlob().client), PNG, detectImageType(PNG)!);
		expect(viaFs).toMatch(pattern);
		expect(viaBlob).toMatch(pattern);
		expect(isUploadPath(viaFs) && isUploadPath(viaBlob)).toBe(true);
	});
});

describe('BlobStore', () => {
	it('memakai pathname uploads/<nama>, store privat, tanpa suffix acak, tanpa menimpa, dan token', async () => {
		const { client, calls } = fakeBlob();
		const store = new BlobStore('token-uji', client);
		await store.put(`${ID}.webp`, WEBP, 'image/webp');
		await store.get(`${ID}.webp`);
		await store.delete(`${ID}.webp`);
		const put = calls.find((c) => c.op === 'put')!;
		expect(put.path).toBe(`uploads/${ID}.webp`);
		expect(put.opts).toMatchObject({ access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'image/webp', token: 'token-uji' });
		for (const c of calls) {
			expect(c.path).toBe(`uploads/${ID}.webp`);
			expect(c.opts).toMatchObject({ token: 'token-uji' });
			if (c.op === 'get') expect(c.opts).toMatchObject({ access: 'private' });
		}
	});
	it('nama tidak berpola tidak pernah menyentuh klien Blob', async () => {
		const { client, calls } = fakeBlob();
		const store = new BlobStore('t', client);
		await store.get('../x.png');
		await store.delete('foto.png');
		await store.put('x', PNG, 'image/png').catch(() => {});
		expect(calls).toEqual([]);
	});
	it('galat selain "tidak ditemukan" saat hapus diteruskan', async () => {
		const { client } = fakeBlob();
		const broken = { ...client, head: async () => { throw new Error('jaringan putus'); } } as unknown as BlobClient;
		await expect(new BlobStore('t', broken).delete(`${ID}.png`)).rejects.toThrow(/jaringan/);
	});
});

it('MAX_UPLOAD_BYTES adalah 4 MB (di bawah batas badan permintaan Vercel 4,5 MB)', () => expect(MAX_UPLOAD_BYTES).toBe(4_194_304));
