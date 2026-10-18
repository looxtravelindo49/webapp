import Database from 'better-sqlite3';
import { DB_PATH, PRICES } from './env';

let db: Database.Database | undefined;

/** Koneksi ke database uji (WAL sudah diatur aplikasi); busy_timeout karena beberapa worker menulis. */
export function conn(): Database.Database {
	if (!db) {
		db = new Database(DB_PATH, { fileMustExist: true });
		db.pragma('busy_timeout = 8000');
	}
	return db;
}

export function query<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
	return conn().prepare(sql).all(...params) as T[];
}

export function scalar<T = unknown>(sql: string, ...params: unknown[]): T {
	return conn().prepare(sql).pluck().get(...params) as T;
}

export function exec(sql: string, ...params: unknown[]): void {
	conn().prepare(sql).run(...params);
}

/**
 * Harga fixture: idempoten (hanya UPDATE nilai tetap), aman dijalankan oleh banyak worker.
 * Aplikasi membaca harga pada setiap request sehingga tidak perlu restart.
 */
let fixturesDone = false;
export function ensureFixtures(): void {
	if (fixturesDone) return;
	const count = scalar<number>('SELECT COUNT(*) FROM package');
	if (!count) throw new Error('Tabel package kosong: server uji belum menyiapkan database (seed).');
	for (const [slug, { price, minPax }] of Object.entries(PRICES)) {
		exec('UPDATE package SET price_per_person = ?, min_pax = ? WHERE slug = ?', price, minPax, slug);
	}
	fixturesDone = true;
}

export const setPublished = (slug: string, published: boolean) =>
	exec('UPDATE package SET published = ? WHERE slug = ?', published ? 1 : 0, slug);

export const setSetting = (key: string, value: string) => exec('UPDATE setting SET value = ? WHERE key = ?', value, key);
export const getSetting = (key: string) => scalar<string | undefined>('SELECT value FROM setting WHERE key = ?', key);
