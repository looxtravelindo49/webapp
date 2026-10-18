import type { PackageValues } from '#lib/package-form.js';
import { slugify, uniqueSlug } from '#lib/slug.js';
import type { Package } from '#lib/types.js';
import { all, column, one, run, scalar, transaction, type Db, type Queryable } from './db';

export type { Package };

const columns = `id, slug, title, summary, body, includes, notes, image, image_alt, duration,
	price_per_person, min_pax, published, sort_order`;

/** Paket terbit, urut menurut sort_order lalu id. */
export function listPublishedPackages(db: Queryable): Promise<Package[]> {
	return all<Package>(db, `SELECT ${columns} FROM package WHERE published = 1 ORDER BY sort_order, id`);
}

// ---------------------------------------------------------------------------
// Pengelolaan paket (CMS admin)
// ---------------------------------------------------------------------------
const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Semua paket (termasuk draft), urut menurut sort_order lalu id. */
export function listAllPackages(db: Queryable): Promise<Package[]> {
	return all<Package>(db, `SELECT ${columns} FROM package ORDER BY sort_order, id`);
}

/** `id` yang bukan bilangan bulat (mis. NaN dari masukan rusak) berarti tidak ada; libSQL menolak NaN sebagai argumen. */
export async function getPackage(db: Queryable, id: number): Promise<Package | null> {
	if (!Number.isInteger(id)) return null;
	return one<Package>(db, `SELECT ${columns} FROM package WHERE id = ?`, [id]);
}

/**
 * Buat paket baru: selalu draft, ditaruh di urutan terakhir, slug otomatis dan unik.
 * `image` adalah path foto (mis. `/uploads/<uuid>.png`) atau null.
 */
export function createPackage(db: Db, values: PackageValues, image: string | null): Promise<Package> {
	return transaction(db, async (tx) => {
		const taken = await column<string>(tx, 'SELECT slug FROM package');
		const slug = uniqueSlug(slugify(values.title), taken);
		const order = (await scalar<number>(tx, 'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM package')) ?? 1;
		const info = await run(
			tx,
			`INSERT INTO package (slug, title, summary, body, includes, notes, image, image_alt, duration,
			                      price_per_person, min_pax, published, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
			[slug, values.title, values.summary, values.body, values.includes, values.notes, image, values.image_alt, values.duration, values.price_per_person, values.min_pax, order]
		);
		return (await getPackage(tx, Number(info.lastInsertRowid)))!;
	});
}

export type UpdateResult = { ok: true; previousImage: string | null } | { ok: false };

/**
 * Perbarui paket. Slug TIDAK berubah. `image`: `undefined` = biarkan, `null` = hapus foto,
 * string = path foto baru. Mengembalikan foto sebelumnya agar pemanggil dapat menghapus berkasnya.
 */
export function updatePackage(db: Db, id: number, values: PackageValues, image?: string | null): Promise<UpdateResult> {
	return transaction(db, async (tx): Promise<UpdateResult> => {
		const current = await getPackage(tx, id);
		if (!current) return { ok: false };
		await run(
			tx,
			`UPDATE package SET title = ?, summary = ?, body = ?, includes = ?, notes = ?, image = ?, image_alt = ?,
			        duration = ?, price_per_person = ?, min_pax = ?, published = ?, updated_at = ${NOW}
			 WHERE id = ?`,
			[
				values.title, values.summary, values.body, values.includes, values.notes,
				image === undefined ? current.image : image,
				values.image_alt, values.duration, values.price_per_person, values.min_pax, values.published ? 1 : 0, id
			]
		);
		return { ok: true, previousImage: current.image };
	});
}

export type DeleteResult = { ok: true; image: string | null } | { ok: false };

/** Hapus paket; mengembalikan path fotonya agar berkas unggahan dapat dihapus. */
export function deletePackage(db: Db, id: number): Promise<DeleteResult> {
	return transaction(db, async (tx): Promise<DeleteResult> => {
		const current = await getPackage(tx, id);
		if (!current) return { ok: false };
		await run(tx, 'DELETE FROM package WHERE id = ?', [id]);
		return { ok: true, image: current.image };
	});
}

export async function setPublished(db: Queryable, id: number, published: boolean): Promise<boolean> {
	const info = await run(db, `UPDATE package SET published = ?, updated_at = ${NOW} WHERE id = ?`, [published ? 1 : 0, id]);
	return info.rowsAffected > 0;
}

export type MoveResult = 'moved' | 'boundary' | 'notfound';

/**
 * Pindahkan paket satu posisi ke atas/bawah: tukar dengan tetangga dalam urutan LENGKAP
 * (draft ikut), lalu rapatkan seluruh sort_order menjadi 1..n dalam satu transaksi.
 * Di batas (pertama/terakhir) tidak mengubah apa pun.
 */
export function movePackage(db: Db, id: number, direction: 'up' | 'down'): Promise<MoveResult> {
	return transaction(db, async (tx): Promise<MoveResult> => {
		const ids = await column<number>(tx, 'SELECT id FROM package ORDER BY sort_order, id');
		const i = ids.indexOf(id);
		if (i < 0) return 'notfound';
		const j = direction === 'up' ? i - 1 : i + 1;
		if (j < 0 || j >= ids.length) return 'boundary';
		[ids[i], ids[j]] = [ids[j], ids[i]];
		for (const [k, pid] of ids.entries()) await run(tx, 'UPDATE package SET sort_order = ? WHERE id = ?', [k + 1, pid]);
		return 'moved';
	});
}

/** `updated_at` terbaru dari paket terbit (untuk `lastmod` beranda di sitemap), atau null bila tidak ada. */
export function latestPackageUpdate(db: Queryable): Promise<string | null> {
	return scalar<string>(db, 'SELECT MAX(updated_at) FROM package WHERE published = 1');
}

/** Jumlah paket terbit yang belum berharga (untuk peringatan di beranda admin). */
export async function countPublishedWithoutPrice(db: Queryable): Promise<number> {
	return (await scalar<number>(db, 'SELECT COUNT(*) FROM package WHERE published = 1 AND price_per_person IS NULL')) ?? 0;
}
