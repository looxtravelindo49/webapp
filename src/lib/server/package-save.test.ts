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
import { FsStore, MAX_UPLOAD_BYTES } from './uploads';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const form = (photo?: File) => ({ get: (n: string) => (n === 'photo' ? (photo ?? null) : null) });
const file = (bytes: BlobPart, name = 'foto.png') => new File([bytes], name);

let dir: string;
let store: FsStore;
const dbs: Db[] = [];
const fresh = async () => {
	const db = await openDatabase(':memory:');
	dbs.push(db);
	await seed(db);
	return db;
};
beforeEach(async () => {
	dir = mkdtempSync(join(tmpdir(), 'save-'));
	store = new FsStore(dir);
});
afterEach(() => {
	dbs.splice(0).forEach((d) => d.close());
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
	it('batas 4 MB: tepat batas diterima, lebih 1 byte ditolak', async () => {
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
	it('tanpa foto: paket draft tanpa gambar dan tanpa berkas', async () => {
		const db = await fresh();
		const p = await createWithPhoto(db, values(), none, store);
		expect(p).toMatchObject({ published: 0, image: null });
		expect(files()).toEqual([]);
	});
	it('dengan foto: berkas tersimpan dan image menunjuknya', async () => {
		const db = await fresh();
		const p = await createWithPhoto(db, values(), png, store);
		expect(p.image).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
		expect(files()).toEqual([p.image!.slice('/uploads/'.length)]);
	});
	it('database gagal → berkas baru dihapus dan galat diteruskan', async () => {
		const db = await fresh();
		db.close();
		await expect(createWithPhoto(db, values(), png, store)).rejects.toThrow();
		expect(files()).toEqual([]);
	});
});

describe('editWithPhoto', () => {
	const slugRow = async (db: Db) => (await listAllPackages(db))[0];

	it('tanpa foto baru: image tidak berubah, nilai teks berubah, slug tetap', async () => {
		const db = await fresh();
		const p = await slugRow(db);
		expect(await editWithPhoto(db, p.id, values({ title: 'Nama Baru' }), { photo: none, removePhoto: false }, store)).toBe(true);
		const after = (await getPackage(db, p.id))!;
		expect(after).toMatchObject({ title: 'Nama Baru', slug: p.slug, image: p.image });
		expect(files()).toEqual([]);
	});
	it('foto baru menggantikan foto statis tanpa menghapus berkas statis (tidak ada di folder)', async () => {
		const db = await fresh();
		const p = await slugRow(db);
		expect(p.image).toMatch(/^\/media\//);
		await editWithPhoto(db, p.id, values(), { photo: png, removePhoto: false }, store);
		expect((await getPackage(db, p.id))!.image).toMatch(/^\/uploads\//);
		expect(files()).toHaveLength(1);
	});
	it('mengganti foto unggahan menghapus berkas lama', async () => {
		const db = await fresh();
		const p = await createWithPhoto(db, values(), png, store);
		const old = files()[0];
		await editWithPhoto(db, p.id, values(), { photo: jpg, removePhoto: false }, store);
		const now = files();
		expect(now).toHaveLength(1);
		expect(now[0]).not.toBe(old);
		expect(now[0]).toMatch(/\.jpg$/);
		expect((await getPackage(db, p.id))!.image).toBe(`/uploads/${now[0]}`);
	});
	it('"Hapus foto" mengosongkan image dan menghapus berkasnya', async () => {
		const db = await fresh();
		const p = await createWithPhoto(db, values(), png, store);
		await editWithPhoto(db, p.id, values(), { photo: none, removePhoto: true }, store);
		expect((await getPackage(db, p.id))!.image).toBeNull();
		expect(files()).toEqual([]);
	});
	it('"Hapus foto" pada foto statis mengosongkan image tanpa galat', async () => {
		const db = await fresh();
		const p = await slugRow(db);
		await editWithPhoto(db, p.id, values(), { photo: none, removePhoto: true }, store);
		expect((await getPackage(db, p.id))!.image).toBeNull();
	});
	it('foto baru + hapus foto: foto baru yang dipakai', async () => {
		const db = await fresh();
		const p = await createWithPhoto(db, values(), png, store);
		await editWithPhoto(db, p.id, values(), { photo: jpg, removePhoto: true }, store);
		expect((await getPackage(db, p.id))!.image).toMatch(/\.jpg$/);
		expect(files()).toHaveLength(1);
	});
	it('id tidak ada → false dan berkas baru tidak tertinggal', async () => {
		const db = await fresh();
		expect(await editWithPhoto(db, 99999, values(), { photo: png, removePhoto: false }, store)).toBe(false);
		expect(files()).toEqual([]);
	});
	it('database gagal → berkas baru dihapus, berkas lama utuh', async () => {
		const db = await fresh();
		const p = await createWithPhoto(db, values(), png, store);
		const before = files();
		writeFileSync(join(dir, 'catatan.txt'), 'x'); // berkas lain tidak tersentuh
		db.close();
		await expect(editWithPhoto(db, p.id, values(), { photo: jpg, removePhoto: false }, store)).rejects.toThrow();
		expect(files().sort()).toEqual([...before, 'catatan.txt'].sort());
	});
});

describe('penyimpanan dibuka hanya bila dibutuhkan', () => {
	const vercel = { ...process.env };
	afterEach(() => {
		for (const k of ['VERCEL', 'BLOB_READ_WRITE_TOKEN']) {
			if (vercel[k] === undefined) delete process.env[k];
			else process.env[k] = vercel[k];
		}
	});

	it('di Vercel tanpa token: simpan dan ubah tanpa foto tetap berhasil', async () => {
		process.env.VERCEL = '1';
		delete process.env.BLOB_READ_WRITE_TOKEN;
		const db = await fresh();
		const p = await createWithPhoto(db, values(), none);
		expect(p.image).toBeNull();
		expect(await editWithPhoto(db, p.id, values({ title: 'Nama Baru' }), { photo: none, removePhoto: false })).toBe(true);
	});

	it('di Vercel tanpa token: unggah foto gagal jelas dan data paket tidak berubah', async () => {
		process.env.VERCEL = '1';
		delete process.env.BLOB_READ_WRITE_TOKEN;
		const db = await fresh();
		const before = (await listAllPackages(db)).length;
		await expect(createWithPhoto(db, values(), png)).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
		expect(await listAllPackages(db)).toHaveLength(before);
	});

	it('hapus foto dari paket yang fotonya bawaan tidak membutuhkan penyimpanan', async () => {
		process.env.VERCEL = '1';
		delete process.env.BLOB_READ_WRITE_TOKEN;
		const db = await fresh();
		const p = (await listAllPackages(db))[0]; // foto bawaan /media/…
		expect(await editWithPhoto(db, p.id, values(), { photo: none, removePhoto: true })).toBe(true);
	});
});
