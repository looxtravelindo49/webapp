import { LIMITS } from '#lib/package-form.js';
import { all, column, one, run, scalar, transaction, type Db, type Queryable } from './db';
import { getPackage } from './packages.js';
import { deleteUpload, getStore, saveImage, type ImageStore, type ImageType } from './uploads.js';

/** Maksimal foto galeri per paket. */
export const GALLERY_LIMIT = 4;

export const GALLERY_FULL_MESSAGE = 'Galeri sudah penuh. Maksimal 4 foto.';
export const GALLERY_ALT_MESSAGE = `Teks alternatif maksimal ${LIMITS.imageAlt} karakter.`;

export type PackagePhoto = {
	id: number;
	package_id: number;
	path: string;
	alt: string | null;
	sort_order: number;
};

const PHOTO_COLUMNS = 'id, package_id, path, alt, sort_order';

export type GalleryAlt = { ok: true; value: string | null } | { ok: false; message: string };

/** Alt kosong menjadi null. Lebih dari batas ditolak. */
export function normalizeGalleryAlt(raw: unknown): GalleryAlt {
	if (raw != null && typeof raw !== 'string') return { ok: false, message: GALLERY_ALT_MESSAGE };
	const text = (raw ?? '').trim();
	if (text.length > LIMITS.imageAlt) return { ok: false, message: GALLERY_ALT_MESSAGE };
	return { ok: true, value: text || null };
}

/** Foto galeri satu paket, urut tampil. */
export function listPackagePhotos(db: Queryable, packageId: number): Promise<PackagePhoto[]> {
	if (!Number.isInteger(packageId)) return Promise.resolve([]);
	return all<PackagePhoto>(
		db,
		`SELECT ${PHOTO_COLUMNS} FROM package_photo WHERE package_id = ? ORDER BY sort_order, id`,
		[packageId]
	);
}

export type GalleryCover = { path: string; alt: string | null };

/** Semua foto galeri tiap paket, urut tampil. Paket tanpa galeri tidak masuk peta. */
export async function packageGalleries(db: Queryable, packageIds: number[]): Promise<Map<number, PackagePhoto[]>> {
	const map = new Map<number, PackagePhoto[]>();
	const ids = packageIds.filter((id) => Number.isInteger(id));
	if (ids.length === 0) return map;
	const rows = await all<PackagePhoto>(
		db,
		`SELECT ${PHOTO_COLUMNS} FROM package_photo WHERE package_id IN (${ids.map(() => '?').join(',')}) ORDER BY package_id, sort_order, id`,
		ids
	);
	for (const row of rows) {
		const list = map.get(row.package_id);
		if (list) list.push(row);
		else map.set(row.package_id, [row]);
	}
	return map;
}

/** Foto pertama (sort_order, lalu id) tiap paket. Paket tanpa galeri tidak masuk peta. */
export async function galleryCovers(db: Queryable, packageIds: number[]): Promise<Map<number, GalleryCover>> {
	const map = new Map<number, GalleryCover>();
	const ids = packageIds.filter((id) => Number.isInteger(id));
	if (ids.length === 0) return map;
	const rows = await all<PackagePhoto>(
		db,
		`SELECT ${PHOTO_COLUMNS} FROM package_photo WHERE package_id IN (${ids.map(() => '?').join(',')}) ORDER BY package_id, sort_order, id`,
		ids
	);
	for (const row of rows) {
		if (!map.has(row.package_id)) map.set(row.package_id, { path: row.path, alt: row.alt });
	}
	return map;
}

export type AddPhotoResult = { ok: true; photo: PackagePhoto } | { ok: false; reason: 'full' | 'missing' };

/** Tambah satu foto di urutan terakhir. Menolak foto kelima. */
export function addPackagePhoto(db: Db, packageId: number, path: string, alt: string | null): Promise<AddPhotoResult> {
	return transaction(db, async (tx): Promise<AddPhotoResult> => {
		if (!(await getPackage(tx, packageId))) return { ok: false, reason: 'missing' };
		const count = Number((await scalar<number>(tx, 'SELECT COUNT(*) FROM package_photo WHERE package_id = ?', [packageId])) ?? 0);
		if (count >= GALLERY_LIMIT) return { ok: false, reason: 'full' };
		const order = Number((await scalar<number>(tx, 'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM package_photo WHERE package_id = ?', [packageId])) ?? 1);
		const info = await run(tx, 'INSERT INTO package_photo (package_id, path, alt, sort_order) VALUES (?, ?, ?, ?)', [packageId, path, alt, order]);
		const photo = (await one<PackagePhoto>(tx, `SELECT ${PHOTO_COLUMNS} FROM package_photo WHERE id = ?`, [Number(info.lastInsertRowid)]))!;
		return { ok: true, photo };
	});
}

/**
 * Simpan berkas lewat penyimpanan unggahan yang sama dengan foto utama, lalu catat di galeri.
 * Bila paket hilang atau galeri penuh, berkas baru dihapus lagi.
 */
export async function attachGalleryPhoto(
	db: Db,
	packageId: number,
	input: { bytes: Uint8Array; type: ImageType },
	alt: string | null,
	store?: ImageStore
): Promise<AddPhotoResult> {
	const s = store ?? getStore();
	const path = await saveImage(s, input.bytes, input.type);
	try {
		const result = await addPackagePhoto(db, packageId, path, alt);
		if (!result.ok) await deleteUpload(s, path).catch((err) => console.error('[uploads] gagal menghapus', path, err));
		return result;
	} catch (err) {
		await deleteUpload(s, path).catch((e) => console.error('[uploads] gagal menghapus', path, e));
		throw err;
	}
}

export async function setPackagePhotoAlt(db: Queryable, packageId: number, photoId: number, alt: string | null): Promise<boolean> {
	if (!Number.isInteger(packageId) || !Number.isInteger(photoId)) return false;
	const info = await run(db, 'UPDATE package_photo SET alt = ? WHERE id = ? AND package_id = ?', [alt, photoId, packageId]);
	return info.rowsAffected > 0;
}

export type RemovePhotoResult = { ok: true; path: string } | { ok: false };

/** Hapus satu foto dan rapatkan sort_order menjadi 1..n. */
export function removePackagePhoto(db: Db, packageId: number, photoId: number): Promise<RemovePhotoResult> {
	return transaction(db, async (tx): Promise<RemovePhotoResult> => {
		if (!Number.isInteger(packageId) || !Number.isInteger(photoId)) return { ok: false };
		const row = await one<{ path: string }>(tx, 'SELECT path FROM package_photo WHERE id = ? AND package_id = ?', [photoId, packageId]);
		if (!row) return { ok: false };
		await run(tx, 'DELETE FROM package_photo WHERE id = ? AND package_id = ?', [photoId, packageId]);
		await compact(tx, packageId);
		return { ok: true, path: row.path };
	});
}

export type MovePhotoResult = 'moved' | 'boundary' | 'notfound';

/** Tukar dengan tetangga, lalu rapatkan urutan. */
export function movePackagePhoto(db: Db, packageId: number, photoId: number, direction: 'up' | 'down'): Promise<MovePhotoResult> {
	return transaction(db, async (tx): Promise<MovePhotoResult> => {
		if (!Number.isInteger(packageId) || !Number.isInteger(photoId)) return 'notfound';
		const ids = await column<number>(tx, 'SELECT id FROM package_photo WHERE package_id = ? ORDER BY sort_order, id', [packageId]);
		const i = ids.map(Number).indexOf(photoId);
		if (i < 0) return 'notfound';
		const j = direction === 'up' ? i - 1 : i + 1;
		if (j < 0 || j >= ids.length) return 'boundary';
		[ids[i], ids[j]] = [ids[j], ids[i]];
		for (const [k, pid] of ids.entries()) {
			await run(tx, 'UPDATE package_photo SET sort_order = ? WHERE id = ? AND package_id = ?', [k + 1, pid, packageId]);
		}
		return 'moved';
	});
}

async function compact(db: Queryable, packageId: number): Promise<void> {
	const ids = await column<number>(db, 'SELECT id FROM package_photo WHERE package_id = ? ORDER BY sort_order, id', [packageId]);
	for (const [k, pid] of ids.entries()) {
		await run(db, 'UPDATE package_photo SET sort_order = ? WHERE id = ? AND package_id = ?', [k + 1, pid, packageId]);
	}
}
