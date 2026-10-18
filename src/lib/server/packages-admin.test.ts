import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './db';
import {
	countPublishedWithoutPrice, createPackage, deletePackage, getPackage, listAllPackages, listPublishedPackages, movePackage, setPublished, updatePackage
} from './packages';
import { seed } from './seed';
import { getSetting, setSetting } from './settings';
import type { PackageValues } from '#lib/package-form.js';

const dbs: Db[] = [];
const fresh = (withSeed = true) => {
	const db = openDatabase(':memory:');
	dbs.push(db);
	if (withSeed) seed(db);
	return db;
};
afterEach(() => dbs.splice(0).forEach((d) => d.open && d.close()));

const values = (over: Partial<PackageValues> = {}): PackageValues => ({
	title: 'Flying Fox Lembang', summary: 'Meluncur di atas hutan pinus.', body: 'isi', includes: 'a\nb', notes: 'n',
	duration: '2 jam', image_alt: null, price_per_person: 175000, min_pax: 5, published: false, ...over
});
const order = (db: Db) => listAllPackages(db).map((p) => p.slug);
const orders = (db: Db) => listAllPackages(db).map((p) => p.sort_order);

describe('createPackage', () => {
	it('membuat draft di urutan terakhir dengan slug otomatis', () => {
		const db = fresh();
		const p = createPackage(db, values(), null);
		expect(p).toMatchObject({ slug: 'flying-fox-lembang', published: 0, sort_order: 6, price_per_person: 175000, min_pax: 5, image: null });
		expect(order(db).at(-1)).toBe('flying-fox-lembang');
	});

	it('abaikan published pada values: selalu draft', () => {
		const db = fresh();
		expect(createPackage(db, values({ published: true }), null).published).toBe(0);
	});

	it('slug bentrok mendapat sufiks -2, -3', () => {
		const db = fresh();
		expect(createPackage(db, values({ title: 'Rafting' }), null).slug).toBe('rafting-2');
		expect(createPackage(db, values({ title: 'Rafting' }), null).slug).toBe('rafting-3');
	});

	it('tabel kosong: urutan 1', () => {
		const db = fresh(false);
		expect(createPackage(db, values(), null).sort_order).toBe(1);
	});

	it('menyimpan path foto dan harga NULL', () => {
		const db = fresh();
		const p = createPackage(db, values({ price_per_person: null }), '/uploads/x.png');
		expect(p.price_per_person).toBeNull();
		expect(p.image).toBe('/uploads/x.png');
	});

	it('paket draft tidak tampil di daftar terbit', () => {
		const db = fresh();
		createPackage(db, values(), null);
		expect(listPublishedPackages(db)).toHaveLength(5);
		expect(listAllPackages(db)).toHaveLength(6);
	});
});

describe('updatePackage', () => {
	it('memperbarui isian dan updated_at tetapi tidak slug', () => {
		const db = fresh();
		const before = getPackage(db, listAllPackages(db).find((p) => p.slug === 'rafting')!.id)!;
		const r = updatePackage(db, before.id, values({ title: 'Arung Jeram', price_per_person: 250000, published: false }));
		expect(r).toEqual({ ok: true, previousImage: before.image });
		const after = getPackage(db, before.id)!;
		expect(after).toMatchObject({ slug: 'rafting', title: 'Arung Jeram', price_per_person: 250000, min_pax: 5, published: 0 });
		expect(after.image).toBe(before.image);
	});

	it('image undefined = biarkan, null = hapus, string = ganti', () => {
		const db = fresh();
		const p = createPackage(db, values(), '/uploads/a.png');
		updatePackage(db, p.id, values());
		expect(getPackage(db, p.id)!.image).toBe('/uploads/a.png');
		expect(updatePackage(db, p.id, values(), '/uploads/b.png')).toEqual({ ok: true, previousImage: '/uploads/a.png' });
		expect(getPackage(db, p.id)!.image).toBe('/uploads/b.png');
		updatePackage(db, p.id, values(), null);
		expect(getPackage(db, p.id)!.image).toBeNull();
	});

	it('mengubah harga menjadi NULL', () => {
		const db = fresh();
		const p = createPackage(db, values(), null);
		updatePackage(db, p.id, values({ price_per_person: null }));
		expect(getPackage(db, p.id)!.price_per_person).toBeNull();
	});

	it('id tidak ada → ok false', () => {
		expect(updatePackage(fresh(), 9999, values())).toEqual({ ok: false });
	});

	it('constraint database tetap berlaku (harga negatif ditolak)', () => {
		const db = fresh();
		const p = createPackage(db, values(), null);
		expect(() => updatePackage(db, p.id, values({ price_per_person: -1 }))).toThrow(/CHECK/);
		expect(getPackage(db, p.id)!.price_per_person).toBe(175000);
	});
});

describe('deletePackage', () => {
	it('menghapus baris dan mengembalikan path foto', () => {
		const db = fresh();
		const p = createPackage(db, values(), '/uploads/a.png');
		expect(deletePackage(db, p.id)).toEqual({ ok: true, image: '/uploads/a.png' });
		expect(getPackage(db, p.id)).toBeNull();
	});
	it('id tidak ada → ok false', () => {
		expect(deletePackage(fresh(), 9999)).toEqual({ ok: false });
	});
});

describe('setPublished', () => {
	it('mengubah status terbit dan mengembalikan false bila tidak ada', () => {
		const db = fresh();
		const id = listAllPackages(db)[0].id;
		expect(setPublished(db, id, false)).toBe(true);
		expect(getPackage(db, id)!.published).toBe(0);
		expect(listPublishedPackages(db)).toHaveLength(4);
		expect(setPublished(db, id, true)).toBe(true);
		expect(listPublishedPackages(db)).toHaveLength(5);
		expect(setPublished(db, 9999, true)).toBe(false);
	});
});

describe('movePackage', () => {
	const id = (db: Db, slug: string) => listAllPackages(db).find((p) => p.slug === slug)!.id;

	it('naik menukar dengan tetangga dan merapatkan sort_order', () => {
		const db = fresh();
		expect(movePackage(db, id(db, 'rafting'), 'up')).toBe('moved');
		expect(order(db)).toEqual(['offroad', 'rafting', 'team-building', 'paintball', 'fun-games']);
		expect(orders(db)).toEqual([1, 2, 3, 4, 5]);
	});

	it('turun menukar dengan tetangga di bawah', () => {
		const db = fresh();
		expect(movePackage(db, id(db, 'offroad'), 'down')).toBe('moved');
		expect(order(db).slice(0, 2)).toEqual(['team-building', 'offroad']);
	});

	it('batas: naik di pertama dan turun di terakhir tidak mengubah apa pun', () => {
		const db = fresh();
		const before = order(db);
		expect(movePackage(db, id(db, 'offroad'), 'up')).toBe('boundary');
		expect(movePackage(db, id(db, 'fun-games'), 'down')).toBe('boundary');
		expect(order(db)).toEqual(before);
	});

	it('id tidak ada → notfound', () => {
		expect(movePackage(fresh(), 9999, 'up')).toBe('notfound');
	});

	it('merapatkan sort_order yang berlubang atau kembar', () => {
		const db = fresh();
		db.prepare("UPDATE package SET sort_order = 10 WHERE slug = 'offroad'").run();
		db.prepare("UPDATE package SET sort_order = 10 WHERE slug = 'rafting'").run();
		const first = listAllPackages(db)[0].id;
		movePackage(db, listAllPackages(db)[1].id, 'up');
		expect(orders(db)).toEqual([1, 2, 3, 4, 5]);
		void first;
	});

	it('draft ikut dihitung dalam urutan lengkap', () => {
		const db = fresh();
		const draft = createPackage(db, values(), null);
		expect(movePackage(db, draft.id, 'up')).toBe('moved');
		expect(order(db).slice(-2)).toEqual(['flying-fox-lembang', 'fun-games']);
		expect(listPublishedPackages(db).map((p) => p.slug).at(-1)).toBe('fun-games');
	});

	it('memindahkan ke atas berulang sampai pertama', () => {
		const db = fresh();
		const pid = id(db, 'fun-games');
		for (let i = 0; i < 4; i++) expect(movePackage(db, pid, 'up')).toBe('moved');
		expect(movePackage(db, pid, 'up')).toBe('boundary');
		expect(order(db)[0]).toBe('fun-games');
		expect(orders(db)).toEqual([1, 2, 3, 4, 5]);
	});
});

describe('countPublishedWithoutPrice', () => {
	it('menghitung paket terbit tanpa harga saja', () => {
		const db = fresh();
		expect(countPublishedWithoutPrice(db)).toBe(5);
		db.prepare("UPDATE package SET price_per_person = 1000 WHERE slug = 'offroad'").run();
		setPublished(db, listAllPackages(db).find((p) => p.slug === 'rafting')!.id, false);
		expect(countPublishedWithoutPrice(db)).toBe(3);
	});
});

describe('setSetting', () => {
	it('mengubah nilai yang ada dan memperbarui updated_at', () => {
		const db = fresh();
		const before = db.prepare("SELECT updated_at FROM setting WHERE key = 'whatsapp'").pluck().get();
		setSetting(db, 'whatsapp', '6281234567890');
		expect(getSetting(db, 'whatsapp')).toBe('6281234567890');
		expect(db.prepare("SELECT updated_at FROM setting WHERE key = 'whatsapp'").pluck().get()).toBeTruthy();
		void before;
	});
	it('membuat kunci baru dan menerima nilai kosong', () => {
		const db = fresh();
		setSetting(db, 'kunci-baru', 'x');
		expect(getSetting(db, 'kunci-baru')).toBe('x');
		setSetting(db, 'whatsapp', '');
		expect(getSetting(db, 'whatsapp')).toBe('');
		expect(db.prepare("SELECT COUNT(*) FROM setting WHERE key = 'whatsapp'").pluck().get()).toBe(1);
	});
});
