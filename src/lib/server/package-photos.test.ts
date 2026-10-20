import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PackageValues } from '#lib/package-form.js';
import { openDatabase, type Db } from './db';
import {
	addPackagePhoto, attachGalleryPhoto, galleryCovers, GALLERY_ALT_MESSAGE, GALLERY_FULL_MESSAGE, GALLERY_LIMIT,
	listPackagePhotos, movePackagePhoto, normalizeGalleryAlt, removePackagePhoto, setPackagePhotoAlt
} from './package-photos';
import { createPackage, deletePackage } from './packages';
import { seed } from './seed';
import { FsStore } from './uploads';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const png = { bytes: PNG, type: { ext: 'png' as const, mime: 'image/png' } };

const values = (title = 'Galeri Uji'): PackageValues => ({
	title, summary: 'ringkas', body: '', includes: '', notes: '', duration: null, image_alt: null,
	price_per_person: null, min_pax: 1, pricing_mode: 'per_person', kapasitas_per_unit: null, nama_unit: null, published: false
});

const dbs: Db[] = [];
const fresh = async () => {
	const db = await openDatabase(':memory:');
	dbs.push(db);
	await seed(db);
	return db;
};
let dir: string;
let store: FsStore;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'galeri-'));
	store = new FsStore(dir);
});
afterEach(() => {
	dbs.splice(0).forEach((d) => d.close());
	rmSync(dir, { recursive: true, force: true });
});
const files = () => readdirSync(dir).sort();

describe('normalizeGalleryAlt', () => {
	it('kosong menjadi null; lebih dari 200 ditolak', () => {
		expect(normalizeGalleryAlt('  ')).toEqual({ ok: true, value: null });
		expect(normalizeGalleryAlt(null)).toEqual({ ok: true, value: null });
		expect(normalizeGalleryAlt('a'.repeat(200))).toEqual({ ok: true, value: 'a'.repeat(200) });
		expect(normalizeGalleryAlt('a'.repeat(201))).toEqual({ ok: false, message: GALLERY_ALT_MESSAGE });
		expect(normalizeGalleryAlt(1)).toEqual({ ok: false, message: GALLERY_ALT_MESSAGE });
	});
});

describe('galeri paket', () => {
	it('menolak foto kelima dan menjaga urutan', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), null);
		for (let i = 1; i <= GALLERY_LIMIT; i++) {
			const added = await addPackagePhoto(db, p.id, `/media/forest.svg`, i === 1 ? 'Pertama' : null);
			expect(added.ok).toBe(true);
		}
		expect(await addPackagePhoto(db, p.id, '/media/camp.svg', null)).toEqual({ ok: false, reason: 'full' });
		expect(GALLERY_FULL_MESSAGE).toContain('4');
		const rows = await listPackagePhotos(db, p.id);
		expect(rows.map((r) => r.sort_order)).toEqual([1, 2, 3, 4]);
		expect(rows[0].alt).toBe('Pertama');
		expect(await addPackagePhoto(db, 99999, '/media/camp.svg', null)).toEqual({ ok: false, reason: 'missing' });
	});

	it('naik, turun, dan hapus merapatkan urutan', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), null);
		const ids: number[] = [];
		for (const path of ['/media/forest.svg', '/media/camp.svg', '/media/river.svg']) {
			const added = await addPackagePhoto(db, p.id, path, null);
			if (!added.ok) throw new Error('gagal menambah');
			ids.push(added.photo.id);
		}
		expect(await movePackagePhoto(db, p.id, ids[0], 'up')).toBe('boundary');
		expect(await movePackagePhoto(db, p.id, ids[0], 'down')).toBe('moved');
		expect((await listPackagePhotos(db, p.id)).map((r) => r.path)).toEqual(['/media/camp.svg', '/media/forest.svg', '/media/river.svg']);
		const middle = (await listPackagePhotos(db, p.id))[1];
		const removed = await removePackagePhoto(db, p.id, middle.id);
		expect(removed).toEqual({ ok: true, path: '/media/forest.svg' });
		const left = await listPackagePhotos(db, p.id);
		expect(left.map((r) => r.sort_order)).toEqual([1, 2]);
		expect(left.map((r) => r.path)).toEqual(['/media/camp.svg', '/media/river.svg']);
		expect(await setPackagePhotoAlt(db, p.id, left[0].id, 'Camp')).toBe(true);
		expect((await listPackagePhotos(db, p.id))[0].alt).toBe('Camp');
		expect(await setPackagePhotoAlt(db, p.id, 99999, 'x')).toBe(false);
		expect(await movePackagePhoto(db, p.id, 99999, 'up')).toBe('notfound');
		expect(await removePackagePhoto(db, p.id, 99999)).toEqual({ ok: false });
	});

	it('sampul katalog adalah foto pertama tiap paket', async () => {
		const db = await fresh();
		const a = await createPackage(db, values('A'), null);
		const b = await createPackage(db, values('B'), null);
		const c = await createPackage(db, values('C'), null);
		await addPackagePhoto(db, a.id, '/media/river.svg', 'Sungai');
		await addPackagePhoto(db, a.id, '/media/camp.svg', 'Camp');
		await addPackagePhoto(db, b.id, '/media/paintball.svg', null);
		const covers = await galleryCovers(db, [a.id, b.id, c.id]);
		expect(covers.get(a.id)).toEqual({ path: '/media/river.svg', alt: 'Sungai' });
		expect(covers.get(b.id)).toEqual({ path: '/media/paintball.svg', alt: null });
		expect(covers.has(c.id)).toBe(false);
		expect((await galleryCovers(db, [])).size).toBe(0);
	});

	it('berkas kelima tidak tertinggal di penyimpanan', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), null);
		for (let i = 0; i < GALLERY_LIMIT; i++) expect((await attachGalleryPhoto(db, p.id, png, null, store)).ok).toBe(true);
		expect(files()).toHaveLength(4);
		expect(await attachGalleryPhoto(db, p.id, png, null, store)).toEqual({ ok: false, reason: 'full' });
		expect(files()).toHaveLength(4);
		expect(await attachGalleryPhoto(db, 99999, png, 'x', store)).toEqual({ ok: false, reason: 'missing' });
		expect(files()).toHaveLength(4);
	});

	it('hapus paket ikut menghapus baris galeri dan mengembalikan path-nya', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), '/uploads/utama.png');
		await addPackagePhoto(db, p.id, '/uploads/a.png', null);
		await addPackagePhoto(db, p.id, '/media/forest.svg', 'pinus');
		expect(await deletePackage(db, p.id)).toEqual({
			ok: true,
			image: '/uploads/utama.png',
			photos: ['/uploads/a.png', '/media/forest.svg']
		});
		expect(await listPackagePhotos(db, p.id)).toEqual([]);
	});
});
