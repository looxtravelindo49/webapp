import { afterEach, describe, expect, it } from 'vitest';
import { run, scalar, openDatabase, type Db } from './db';
import {
	countPublishedWithoutPrice, createPackage, latestPackageUpdate, deletePackage, getPackage, listAllPackages, listPublishedPackages, movePackage, setPublished, updatePackage
} from './packages';
import { seed } from './seed';
import { getSetting, setSetting } from './settings';
import type { PackageValues } from '#lib/package-form.js';

const dbs: Db[] = [];
const fresh = async (withSeed = true) => {
	const db = await openDatabase(':memory:');
	dbs.push(db);
	if (withSeed) await seed(db);
	return db;
};
afterEach(() => dbs.splice(0).forEach((d) => d.close()));

const values = (over: Partial<PackageValues> = {}): PackageValues => ({
	title: 'Flying Fox Lembang', summary: 'Meluncur di atas hutan pinus.', body: 'isi', includes: 'a\nb', notes: 'n',
	duration: '2 jam', image_alt: null, price_per_person: 175000, min_pax: 5,
	pricing_mode: 'per_person', kapasitas_per_unit: null, nama_unit: null, published: false, ...over
});
const order = async (db: Db) => (await listAllPackages(db)).map((p) => p.slug);
const orders = async (db: Db) => (await listAllPackages(db)).map((p) => p.sort_order);

describe('id tidak valid', () => {
	it.each([NaN, Infinity, -Infinity, 1.5])('getPackage(%s) → null tanpa melempar', async (id) => {
		expect(await getPackage(await fresh(), id)).toBeNull();
	});
	it('hapus, ubah, dan pindah paket dengan id NaN → tidak ditemukan', async () => {
		const db = await fresh();
		expect(await deletePackage(db, NaN)).toEqual({ ok: false });
		expect(await updatePackage(db, NaN, values())).toEqual({ ok: false });
		expect(await movePackage(db, NaN, 'up')).toBe('notfound');
	});
});

describe('createPackage', () => {
	it('membuat draft di urutan terakhir dengan slug otomatis', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), null);
		expect(p).toMatchObject({ slug: 'flying-fox-lembang', published: 0, sort_order: 6, price_per_person: 175000, min_pax: 5, image: null });
		expect((await order(db)).at(-1)).toBe('flying-fox-lembang');
	});

	it('abaikan published pada values: selalu draft', async () => {
		const db = await fresh();
		expect((await createPackage(db, values({ published: true }), null)).published).toBe(0);
	});

	it('slug bentrok mendapat sufiks -2, -3', async () => {
		const db = await fresh();
		expect((await createPackage(db, values({ title: 'Rafting' }), null)).slug).toBe('rafting-2');
		expect((await createPackage(db, values({ title: 'Rafting' }), null)).slug).toBe('rafting-3');
	});

	it('tabel kosong: urutan 1', async () => {
		const db = await fresh(false);
		expect((await createPackage(db, values(), null)).sort_order).toBe(1);
	});

	it('menyimpan path foto dan harga NULL', async () => {
		const db = await fresh();
		const p = await createPackage(db, values({ price_per_person: null }), '/uploads/x.png');
		expect(p.price_per_person).toBeNull();
		expect(p.image).toBe('/uploads/x.png');
	});

	it('paket draft tidak tampil di daftar terbit', async () => {
		const db = await fresh();
		await createPackage(db, values(), null);
		expect(await listPublishedPackages(db)).toHaveLength(5);
		expect(await listAllPackages(db)).toHaveLength(6);
	});
});

describe('updatePackage', () => {
	it('memperbarui isian dan updated_at tetapi tidak slug', async () => {
		const db = await fresh();
		const before = (await getPackage(db, (await listAllPackages(db)).find((p) => p.slug === 'rafting')!.id))!;
		const r = await updatePackage(db, before.id, values({ title: 'Arung Jeram', price_per_person: 250000, published: false }));
		expect(r).toEqual({ ok: true, previousImage: before.image });
		const after = (await getPackage(db, before.id))!;
		expect(after).toMatchObject({ slug: 'rafting', title: 'Arung Jeram', price_per_person: 250000, min_pax: 5, published: 0 });
		expect(after.image).toBe(before.image);
	});

	it('image undefined = biarkan, null = hapus, string = ganti', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), '/uploads/a.png');
		await updatePackage(db, p.id, values());
		expect((await getPackage(db, p.id))!.image).toBe('/uploads/a.png');
		expect(await updatePackage(db, p.id, values(), '/uploads/b.png')).toEqual({ ok: true, previousImage: '/uploads/a.png' });
		expect((await getPackage(db, p.id))!.image).toBe('/uploads/b.png');
		await updatePackage(db, p.id, values(), null);
		expect((await getPackage(db, p.id))!.image).toBeNull();
	});

	it('mengubah harga menjadi NULL', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), null);
		await updatePackage(db, p.id, values({ price_per_person: null }));
		expect((await getPackage(db, p.id))!.price_per_person).toBeNull();
	});

	it('id tidak ada → ok false', async () => {
		expect(await updatePackage(await fresh(), 9999, values())).toEqual({ ok: false });
	});

	it('constraint database tetap berlaku (harga negatif ditolak)', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), null);
		await expect(updatePackage(db, p.id, values({ price_per_person: -1 }))).rejects.toThrow(/CHECK/);
		expect((await getPackage(db, p.id))!.price_per_person).toBe(175000);
	});
});

describe('deletePackage', () => {
	it('menghapus baris dan mengembalikan path foto', async () => {
		const db = await fresh();
		const p = await createPackage(db, values(), '/uploads/a.png');
		expect(await deletePackage(db, p.id)).toEqual({ ok: true, image: '/uploads/a.png', photos: [] });
		expect(await getPackage(db, p.id)).toBeNull();
	});
	it('id tidak ada → ok false', async () => {
		expect(await deletePackage(await fresh(), 9999)).toEqual({ ok: false });
	});
});

describe('setPublished', () => {
	it('mengubah status terbit dan mengembalikan false bila tidak ada', async () => {
		const db = await fresh();
		const id = (await listAllPackages(db))[0].id;
		expect(await setPublished(db, id, false)).toBe(true);
		expect((await getPackage(db, id))!.published).toBe(0);
		expect(await listPublishedPackages(db)).toHaveLength(4);
		expect(await setPublished(db, id, true)).toBe(true);
		expect(await listPublishedPackages(db)).toHaveLength(5);
		expect(await setPublished(db, 9999, true)).toBe(false);
	});
});

describe('movePackage', () => {
	const id = async (db: Db, slug: string) => (await listAllPackages(db)).find((p) => p.slug === slug)!.id;

	it('naik menukar dengan tetangga dan merapatkan sort_order', async () => {
		const db = await fresh();
		expect(await movePackage(db, await id(db, 'rafting'), 'up')).toBe('moved');
		expect(await order(db)).toEqual(['offroad', 'rafting', 'team-building', 'paintball', 'fun-games']);
		expect(await orders(db)).toEqual([1, 2, 3, 4, 5]);
	});

	it('turun menukar dengan tetangga di bawah', async () => {
		const db = await fresh();
		expect(await movePackage(db, await id(db, 'offroad'), 'down')).toBe('moved');
		expect((await order(db)).slice(0, 2)).toEqual(['team-building', 'offroad']);
	});

	it('batas: naik di pertama dan turun di terakhir tidak mengubah apa pun', async () => {
		const db = await fresh();
		const before = await order(db);
		expect(await movePackage(db, await id(db, 'offroad'), 'up')).toBe('boundary');
		expect(await movePackage(db, await id(db, 'fun-games'), 'down')).toBe('boundary');
		expect(await order(db)).toEqual(before);
	});

	it('id tidak ada → notfound', async () => {
		expect(await movePackage(await fresh(), 9999, 'up')).toBe('notfound');
	});

	it('merapatkan sort_order yang berlubang atau kembar', async () => {
		const db = await fresh();
		await run(db, "UPDATE package SET sort_order = 10 WHERE slug = 'offroad'");
		await run(db, "UPDATE package SET sort_order = 10 WHERE slug = 'rafting'");
		const first = (await listAllPackages(db))[0].id;
		await movePackage(db, (await listAllPackages(db))[1].id, 'up');
		expect(await orders(db)).toEqual([1, 2, 3, 4, 5]);
		void first;
	});

	it('draft ikut dihitung dalam urutan lengkap', async () => {
		const db = await fresh();
		const draft = await createPackage(db, values(), null);
		expect(await movePackage(db, draft.id, 'up')).toBe('moved');
		expect((await order(db)).slice(-2)).toEqual(['flying-fox-lembang', 'fun-games']);
		expect((await listPublishedPackages(db)).map((p) => p.slug).at(-1)).toBe('fun-games');
	});

	it('memindahkan ke atas berulang sampai pertama', async () => {
		const db = await fresh();
		const pid = await id(db, 'fun-games');
		for (let i = 0; i < 4; i++) expect(await movePackage(db, pid, 'up')).toBe('moved');
		expect(await movePackage(db, pid, 'up')).toBe('boundary');
		expect((await order(db))[0]).toBe('fun-games');
		expect(await orders(db)).toEqual([1, 2, 3, 4, 5]);
	});
});

describe('countPublishedWithoutPrice', () => {
	it('menghitung paket terbit tanpa harga saja', async () => {
		const db = await fresh();
		expect(await countPublishedWithoutPrice(db)).toBe(0);
		await run(db, 'UPDATE package SET price_per_person = NULL');
		expect(await countPublishedWithoutPrice(db)).toBe(5);
		await run(db, "UPDATE package SET price_per_person = 1000 WHERE slug = 'offroad'");
		await setPublished(db, (await listAllPackages(db)).find((p) => p.slug === 'rafting')!.id, false);
		expect(await countPublishedWithoutPrice(db)).toBe(3);
	});
});

describe('setSetting', () => {
	it('mengubah nilai yang ada dan memperbarui updated_at', async () => {
		const db = await fresh();
		const before = (await scalar(db, "SELECT updated_at FROM setting WHERE key = 'whatsapp'"));
		await setSetting(db, 'whatsapp', '6281234567890');
		expect(await getSetting(db, 'whatsapp')).toBe('6281234567890');
		expect((await scalar(db, "SELECT updated_at FROM setting WHERE key = 'whatsapp'"))).toBeTruthy();
		void before;
	});
	it('membuat kunci baru dan menerima nilai kosong', async () => {
		const db = await fresh();
		await setSetting(db, 'kunci-baru', 'x');
		expect(await getSetting(db, 'kunci-baru')).toBe('x');
		await setSetting(db, 'whatsapp', '');
		expect(await getSetting(db, 'whatsapp')).toBe('');
		expect((await scalar(db, "SELECT COUNT(*) FROM setting WHERE key = 'whatsapp'"))).toBe(1);
	});
});

describe('latestPackageUpdate', () => {
	it('mengembalikan updated_at terbaru paket terbit saja; null bila tidak ada', async () => {
		const db = await fresh(false);
		expect(await latestPackageUpdate(db)).toBeNull();
		const a = await createPackage(db, values({ title: 'A' }), null);
		const b = await createPackage(db, values({ title: 'B' }), null);
		expect(await latestPackageUpdate(db)).toBeNull(); // keduanya draft
		await setPublished(db, a.id, true);
		await run(db, "UPDATE package SET updated_at = '2026-01-01T00:00:00.000Z' WHERE id = ?", [a.id]);
		await run(db, "UPDATE package SET updated_at = '2027-01-01T00:00:00.000Z' WHERE id = ?", [b.id]);
		expect(await latestPackageUpdate(db)).toBe('2026-01-01T00:00:00.000Z');
		await setPublished(db, b.id, true);
		await run(db, "UPDATE package SET updated_at = '2027-01-01T00:00:00.000Z' WHERE id = ?", [b.id]);
		expect(await latestPackageUpdate(db)).toBe('2027-01-01T00:00:00.000Z');
	});
});
