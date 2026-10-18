import type { PackageValues } from '#lib/package-form.js';
import { slugify, uniqueSlug } from '#lib/slug.js';
import type { Package } from '#lib/types.js';
import type { Db } from './db';

export type { Package };

const columns = `id, slug, title, summary, body, includes, notes, image, image_alt, duration,
	price_per_person, min_pax, published, sort_order`;

/** Paket terbit, urut menurut sort_order lalu id. */
export function listPublishedPackages(db: Db): Package[] {
	return db
		.prepare(`SELECT ${columns} FROM package WHERE published = 1 ORDER BY sort_order, id`)
		.all() as Package[];
}

// ---------------------------------------------------------------------------
// Pengelolaan paket (CMS admin)
// ---------------------------------------------------------------------------
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Semua paket (termasuk draft), urut menurut sort_order lalu id. */
export function listAllPackages(db: Db): Package[] {
	return db.prepare(`SELECT ${columns} FROM package ORDER BY sort_order, id`).all() as Package[];
}

export function getPackage(db: Db, id: number): Package | null {
	return (db.prepare(`SELECT ${columns} FROM package WHERE id = ?`).get(id) as Package | undefined) ?? null;
}

/**
 * Buat paket baru: selalu draft, ditaruh di urutan terakhir, slug otomatis dan unik.
 * `image` adalah path foto (mis. `/uploads/<uuid>.png`) atau null.
 */
export function createPackage(db: Db, values: PackageValues, image: string | null): Package {
	return db.transaction(() => {
		const taken = db.prepare('SELECT slug FROM package').pluck().all() as string[];
		const slug = uniqueSlug(slugify(values.title), taken);
		const order = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM package').pluck().get() as number) ?? 1;
		const info = db
			.prepare(
				`INSERT INTO package (slug, title, summary, body, includes, notes, image, image_alt, duration,
				                      price_per_person, min_pax, published, sort_order)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
			)
			.run(slug, values.title, values.summary, values.body, values.includes, values.notes, image, values.image_alt, values.duration, values.price_per_person, values.min_pax, order);
		return getPackage(db, Number(info.lastInsertRowid))!;
	})();
}

export type UpdateResult = { ok: true; previousImage: string | null } | { ok: false };

/**
 * Perbarui paket. Slug TIDAK berubah. `image`: `undefined` = biarkan, `null` = hapus foto,
 * string = path foto baru. Mengembalikan foto sebelumnya agar pemanggil dapat menghapus berkasnya.
 */
export function updatePackage(db: Db, id: number, values: PackageValues, image?: string | null): UpdateResult {
	return db.transaction((): UpdateResult => {
		const current = getPackage(db, id);
		if (!current) return { ok: false };
		db.prepare(
			`UPDATE package SET title = ?, summary = ?, body = ?, includes = ?, notes = ?, image = ?, image_alt = ?,
			        duration = ?, price_per_person = ?, min_pax = ?, published = ?, updated_at = ${NOW}
			 WHERE id = ?`
		).run(
			values.title, values.summary, values.body, values.includes, values.notes,
			image === undefined ? current.image : image,
			values.image_alt, values.duration, values.price_per_person, values.min_pax, values.published ? 1 : 0, id
		);
		return { ok: true, previousImage: current.image };
	})();
}

export type DeleteResult = { ok: true; image: string | null } | { ok: false };

/** Hapus paket; mengembalikan path fotonya agar berkas unggahan dapat dihapus. */
export function deletePackage(db: Db, id: number): DeleteResult {
	return db.transaction((): DeleteResult => {
		const current = getPackage(db, id);
		if (!current) return { ok: false };
		db.prepare('DELETE FROM package WHERE id = ?').run(id);
		return { ok: true, image: current.image };
	})();
}

export function setPublished(db: Db, id: number, published: boolean): boolean {
	const info = db.prepare(`UPDATE package SET published = ?, updated_at = ${NOW} WHERE id = ?`).run(published ? 1 : 0, id);
	return info.changes > 0;
}

export type MoveResult = 'moved' | 'boundary' | 'notfound';

/**
 * Pindahkan paket satu posisi ke atas/bawah: tukar dengan tetangga dalam urutan LENGKAP
 * (draft ikut), lalu rapatkan seluruh sort_order menjadi 1..n dalam satu transaksi.
 * Di batas (pertama/terakhir) tidak mengubah apa pun.
 */
export function movePackage(db: Db, id: number, direction: 'up' | 'down'): MoveResult {
	return db.transaction((): MoveResult => {
		const ids = db.prepare('SELECT id FROM package ORDER BY sort_order, id').pluck().all() as number[];
		const i = ids.indexOf(id);
		if (i < 0) return 'notfound';
		const j = direction === 'up' ? i - 1 : i + 1;
		if (j < 0 || j >= ids.length) return 'boundary';
		[ids[i], ids[j]] = [ids[j], ids[i]];
		const set = db.prepare('UPDATE package SET sort_order = ? WHERE id = ?');
		ids.forEach((pid, k) => set.run(k + 1, pid));
		return 'moved';
	})();
}

/** Jumlah paket terbit yang belum berharga (untuk peringatan di beranda admin). */
export function countPublishedWithoutPrice(db: Db): number {
	return db.prepare('SELECT COUNT(*) FROM package WHERE published = 1 AND price_per_person IS NULL').pluck().get() as number;
}
