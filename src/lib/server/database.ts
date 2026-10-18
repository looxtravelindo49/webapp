import { building } from '$app/env';
import { databaseTarget, openDatabase, type Db } from './db';
import { seed } from './seed';

let ready: Promise<Db> | undefined;

/** Koneksi tunggal per instance; membuka database, migrasi, lalu seed pada pemanggilan pertama. */
export function getDb(): Promise<Db> {
	if (building) throw new Error('Database tidak tersedia saat build.');
	ready ??= (async () => {
		const target = databaseTarget();
		const db = await openDatabase(target, undefined, process.env.DATABASE_AUTH_TOKEN);
		await seed(db);
		console.log(`[db] siap di ${target.replace(/\?.*$/, '')}`);
		return db;
	})().catch((err) => {
		ready = undefined; // izinkan percobaan ulang pada pemanggilan berikutnya
		throw err;
	});
	return ready;
}
