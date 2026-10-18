import { building } from '$app/env';
import { openDatabase, type Db } from './db';
import { seed } from './seed';

let db: Db | undefined;

/** Koneksi tunggal; membuka database, migrasi, lalu seed pada pemanggilan pertama. */
export function getDb(): Db {
	if (building) throw new Error('Database tidak tersedia saat build.');
	if (!db) {
		const path = process.env.DATABASE_PATH || './data/app.db';
		db = openDatabase(path);
		seed(db);
		console.log(`[db] siap di ${path}`);
	}
	return db;
}
