import { mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PackageValues } from '#lib/package-form.js';
import { openDatabase, type Db } from './db';
import {
	createWithPhoto, editWithPhoto, PHOTO_EMPTY_MESSAGE, PHOTO_SIZE_MESSAGE, PHOTO_TYPE_MESSAGE, readPhoto, type PhotoInput
} from './package-save';
import { getPackage, listAllPackages } from './packages';
import { seed } from './seed';
import { MAX_UPLOAD_BYTES } from './uploads';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const form = (photo?: File) => ({ get: (n: string) => (n === 'photo' ? (photo ?? null) : null) });
const file = (bytes: BlobPart, name = 'foto.png') => new File([bytes], name);

let dir: string;
const dbs: Db[] = [];
const fresh = () => {
	const db = openDatabase(':memory:');
	dbs.push(db);
	seed(db);
	return db;
};
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'save-'));
});
afterEach(() => {
	dbs.splice(0).forEach((d) => d.open && d.close());
	rmSync(dir, { recursive: true, force: true });
});
const files = () => (existsSync(dir) ? readdirSync(dir) : []);

const values = (over: Partial<PackageValues> = {}): PackageValues => ({
	title: 'Flying Fox', summary: 'ringkas', body: '', includes: '', notes: '', duration: null, image_alt: null,
	price_per_person: null, min_pax: 1, published: false, ...over
});
const png: PhotoInput = { kind: 'new', bytes: PNG, type: { ext: 'png', mime: 'image/png' } };
const jpg: PhotoInput = { kind: 'new', bytes: JPG, type: { ext: 'jpg', mime: 'image/jpeg' } };
const none: PhotoInput = { kind: 'none' };

describe('readPhoto', () => {
	it('tanpa isian atau berkas kosong tanpa nama → none', async () => {
		expect(await readPhoto(form())).toEqual({ kind: 'none' });
		expect(await readPhoto(form(file('', '')))).toEqual({ kind: 'none' });
	});
	it('berkas kosong bernama → kesalahan', async () => {
		expect(await readPhoto(form(file('')))).toEqual({ kind: 'error', message: PHOTO_EMPTY_MESSAGE });
	});
	it('jenis dari isi: PNG bernama .txt diterima, teks bernama .png ditolak', async () => {
		const ok = await readPhoto(form(file(PNG, 'foto.txt')));
		expect(ok.kind === 'new' && ok.type.ext).toBe('png');
		expect(await readPhoto(form(file('halo dunia', 'foto.png')))).toEqual({ kind: 'error', message: PHOTO_TYPE_MESSAGE });
	});
	it('SVG ditolak', async () => {
		expect(await readPhoto(form(file('<svg xmlns="http://www.w3.org/2000/svg"/>', 'a.svg')))).toEqual({ kind: 'error', message: PHOTO_TYPE_MESSAGE });
	});
	it('batas 5 MB: tepat batas diterima, lebih 1 byte ditolak', async () => {
		const at = new Uint8Array(MAX_UPLOAD_BYTES);
		at.set(PNG);
		expect((await readPhoto(form(file(at)))).kind).toBe('new');
		const over = new Uint8Array(MAX_UPLOAD_BYTES + 1);
		over.set(PNG);
		expect(await readPhoto(form(file(over)))).toEqual({ kind: 'error', message: PHOTO_SIZE_MESSAGE });
	});
	it('nilai bukan berkas (string) → none', async () => {
		expect(await readPhoto({ get: () => 'x' })).toEqual({ kind: 'none' });
	});
});

describe('createWithPhoto', () => {
	it('tanpa foto: paket draft tanpa gambar dan tanpa berkas', () => {
		const db = fresh();
		const p = createWithPhoto(db, values(), none, dir);
		expect(p).toMatchObject({ published: 0, image: null });
		expect(files()).toEqual([]);
	});
	it('dengan foto: berkas tersimpan dan image menunjuknya', () => {
		const db = fresh();
		const p = createWithPhoto(db, values(), png, dir);
		expect(p.image).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
		expect(files()).toEqual([p.image!.slice('/uploads/'.length)]);
	});
	it('database gagal → berkas baru dihapus dan galat diteruskan', () => {
		const db = fresh();
		db.close();
		expect(() => createWithPhoto(db, values(), png, dir)).toThrow();
		expect(files()).toEqual([]);
	});
});

describe('editWithPhoto', () => {
	const slugRow = (db: Db) => listAllPackages(db)[0];

	it('tanpa foto baru: image tidak berubah, nilai teks berubah, slug tetap', () => {
		const db = fresh();
		const p = slugRow(db);
		expect(editWithPhoto(db, p.id, values({ title: 'Nama Baru' }), { photo: none, removePhoto: false }, dir)).toBe(true);
		const after = getPackage(db, p.id)!;
		expect(after).toMatchObject({ title: 'Nama Baru', slug: p.slug, image: p.image });
		expect(files()).toEqual([]);
	});
	it('foto baru menggantikan foto statis tanpa menghapus berkas statis (tidak ada di folder)', () => {
		const db = fresh();
		const p = slugRow(db);
		expect(p.image).toMatch(/^\/media\//);
		editWithPhoto(db, p.id, values(), { photo: png, removePhoto: false }, dir);
		expect(getPackage(db, p.id)!.image).toMatch(/^\/uploads\//);
		expect(files()).toHaveLength(1);
	});
	it('mengganti foto unggahan menghapus berkas lama', () => {
		const db = fresh();
		const p = createWithPhoto(db, values(), png, dir);
		const old = files()[0];
		editWithPhoto(db, p.id, values(), { photo: jpg, removePhoto: false }, dir);
		const now = files();
		expect(now).toHaveLength(1);
		expect(now[0]).not.toBe(old);
		expect(now[0]).toMatch(/\.jpg$/);
		expect(getPackage(db, p.id)!.image).toBe(`/uploads/${now[0]}`);
	});
	it('"Hapus foto" mengosongkan image dan menghapus berkasnya', () => {
		const db = fresh();
		const p = createWithPhoto(db, values(), png, dir);
		editWithPhoto(db, p.id, values(), { photo: none, removePhoto: true }, dir);
		expect(getPackage(db, p.id)!.image).toBeNull();
		expect(files()).toEqual([]);
	});
	it('"Hapus foto" pada foto statis mengosongkan image tanpa galat', () => {
		const db = fresh();
		const p = slugRow(db);
		editWithPhoto(db, p.id, values(), { photo: none, removePhoto: true }, dir);
		expect(getPackage(db, p.id)!.image).toBeNull();
	});
	it('foto baru + hapus foto: foto baru yang dipakai', () => {
		const db = fresh();
		const p = createWithPhoto(db, values(), png, dir);
		editWithPhoto(db, p.id, values(), { photo: jpg, removePhoto: true }, dir);
		expect(getPackage(db, p.id)!.image).toMatch(/\.jpg$/);
		expect(files()).toHaveLength(1);
	});
	it('id tidak ada → false dan berkas baru tidak tertinggal', () => {
		const db = fresh();
		expect(editWithPhoto(db, 99999, values(), { photo: png, removePhoto: false }, dir)).toBe(false);
		expect(files()).toEqual([]);
	});
	it('database gagal → berkas baru dihapus, berkas lama utuh', () => {
		const db = fresh();
		const p = createWithPhoto(db, values(), png, dir);
		const before = files();
		writeFileSync(join(dir, 'catatan.txt'), 'x'); // berkas lain tidak tersentuh
		db.close();
		expect(() => editWithPhoto(db, p.id, values(), { photo: jpg, removePhoto: false }, dir)).toThrow();
		expect(files().sort()).toEqual([...before, 'catatan.txt'].sort());
	});
});
