import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_UPLOAD_BYTES, UPLOAD_NAME, deleteUpload, detectImageType, isUploadPath, mimeForName, saveImage, uploadDir, uploadFile } from './uploads';

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

describe('saveImage', () => {
	it('menyimpan dengan nama UUID + ekstensi dari jenis terdeteksi dan membuat folder', () => {
		const dir = join(tmp(), 'belum', 'ada');
		const path = saveImage(PNG, detectImageType(PNG)!, dir);
		expect(path).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
		const name = path.replace('/uploads/', '');
		expect(UPLOAD_NAME.test(name)).toBe(true);
		expect(readFileSync(join(dir, name))).toEqual(Buffer.from(PNG));
		expect(readdirSync(dir)).toEqual([name]);
	});

	it('nama unik untuk setiap unggahan', () => {
		const dir = tmp();
		const a = saveImage(JPEG, detectImageType(JPEG)!, dir);
		const b = saveImage(JPEG, detectImageType(JPEG)!, dir);
		expect(a).not.toBe(b);
		expect(readdirSync(dir)).toHaveLength(2);
	});

	it('ekstensi mengikuti isi, bukan nama asli (tidak pernah dipakai)', () => {
		const dir = tmp();
		expect(saveImage(PNG, detectImageType(PNG)!, dir).endsWith('.png')).toBe(true);
		expect(saveImage(AVIF, detectImageType(AVIF)!, dir).endsWith('.avif')).toBe(true);
		expect(saveImage(WEBP, detectImageType(WEBP)!, dir).endsWith('.webp')).toBe(true);
		expect(saveImage(JPEG, detectImageType(JPEG)!, dir).endsWith('.jpg')).toBe(true);
	});

	it('tidak menulis di luar folder unggahan', () => {
		const root = tmp();
		const dir = join(root, 'uploads');
		saveImage(PNG, detectImageType(PNG)!, dir);
		expect(readdirSync(root)).toEqual(['uploads']);
	});
});

describe('isUploadPath / uploadFile', () => {
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

	it('uploadFile hanya untuk nama berpola', () => {
		expect(uploadFile(`${good}.png`, '/x')).toBe(`/x/${good}.png`);
		for (const bad of ['..', '../x.png', `${good}.svg`, 'foto.png', `${good}.png/..`, '']) expect(uploadFile(bad, '/x'), bad).toBeNull();
	});
	it('mimeForName', () => {
		expect(mimeForName(`${good}.jpg`)).toBe('image/jpeg');
		expect(mimeForName(`${good}.avif`)).toBe('image/avif');
		expect(mimeForName(`${good}.svg`)).toBeNull();
	});
});

describe('deleteUpload', () => {
	it('menghapus berkas unggahan yang ada', () => {
		const dir = tmp();
		const path = saveImage(PNG, detectImageType(PNG)!, dir);
		expect(deleteUpload(path, dir)).toBe(true);
		expect(readdirSync(dir)).toEqual([]);
	});
	it('mengabaikan path di luar /uploads/ (mis. foto statis) dan berkas yang tidak ada', () => {
		const dir = tmp();
		writeFileSync(join(dir, 'forest.svg'), 'x');
		expect(deleteUpload('/media/forest.svg', dir)).toBe(false);
		expect(deleteUpload('/uploads/forest.svg', dir)).toBe(false);
		expect(deleteUpload('/uploads/0b6f3c1e-9d2a-4f7b-8c10-1a2b3c4d5e6f.png', dir)).toBe(false);
		expect(deleteUpload(null, dir)).toBe(false);
		expect(existsSync(join(dir, 'forest.svg'))).toBe(true);
	});
	it('tidak bisa menghapus berkas lain lewat traversal', () => {
		const root = tmp();
		const dir = join(root, 'uploads');
		saveImage(PNG, detectImageType(PNG)!, dir);
		writeFileSync(join(root, 'penting.png'), 'x');
		expect(deleteUpload('/uploads/../penting.png', dir)).toBe(false);
		expect(existsSync(join(root, 'penting.png'))).toBe(true);
	});
});

it('MAX_UPLOAD_BYTES adalah 5 MB', () => expect(MAX_UPLOAD_BYTES).toBe(5_242_880));
