import { createClient, type Client, type InArgs, type ResultSet, type Transaction } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = Client;
/** `Client` maupun `Transaction`: fungsi data yang hanya membaca/menulis menerima keduanya. */
export type Queryable = Pick<Client, 'execute'>;
export type Migration = { version: string; sql: string };

const files = import.meta.glob('/migrations/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true
}) as Record<string, string>;

/** Migrasi bawaan aplikasi, diurutkan menurut nama berkas (0001_init, 0002_...). */
export const migrations: Migration[] = Object.entries(files)
	.map(([path, sql]) => ({ version: path.split('/').pop()!.replace(/\.sql$/, ''), sql }))
	.sort((a, b) => a.version.localeCompare(b.version));

// ---------------------------------------------------------------------------
// Pembantu kueri: baris libSQL dipetakan ke objek biasa agar aman diserialisasi SvelteKit.
// ---------------------------------------------------------------------------

/** Semua baris sebagai objek biasa bertipe `T`. */
export async function all<T = Record<string, unknown>>(q: Queryable, sql: string, args: InArgs = []): Promise<T[]> {
	const rs = await q.execute({ sql, args });
	return rs.rows.map((row) => {
		const obj: Record<string, unknown> = {};
		rs.columns.forEach((col, i) => (obj[col] = row[i]));
		return obj as T;
	});
}

/** Baris pertama, atau `null` bila kosong. */
export async function one<T = Record<string, unknown>>(q: Queryable, sql: string, args: InArgs = []): Promise<T | null> {
	return (await all<T>(q, sql, args))[0] ?? null;
}

/** Nilai kolom pertama dari baris pertama, atau `null` bila kosong. */
export async function scalar<T = unknown>(q: Queryable, sql: string, args: InArgs = []): Promise<T | null> {
	const rs = await q.execute({ sql, args });
	return rs.rows.length ? (rs.rows[0][0] as T) : null;
}

/** Kolom pertama dari semua baris. */
export async function column<T = unknown>(q: Queryable, sql: string, args: InArgs = []): Promise<T[]> {
	const rs = await q.execute({ sql, args });
	return rs.rows.map((row) => row[0] as T);
}

/** Jalankan pernyataan tulis; `rowsAffected` dan `lastInsertRowid` ada di hasilnya. */
export function run(q: Queryable, sql: string, args: InArgs = []): Promise<ResultSet> {
	return q.execute({ sql, args });
}

/**
 * Jalankan `fn` dalam satu transaksi tulis: commit bila selesai, rollback bila melempar.
 * Pernyataan di dalamnya harus memakai `tx`, bukan `db`.
 */
export async function transaction<T>(db: Db, fn: (tx: Transaction) => Promise<T>): Promise<T> {
	const tx = await db.transaction('write');
	try {
		const result = await fn(tx);
		await tx.commit();
		return result;
	} catch (err) {
		try {
			await tx.rollback();
		} catch {
			// rollback gagal tidak boleh menutupi galat asli
		}
		throw err;
	} finally {
		tx.close();
	}
}

// ---------------------------------------------------------------------------
// Migrasi
// ---------------------------------------------------------------------------

/**
 * Terapkan migrasi yang belum tercatat di `schema_migrations`, berurutan, masing-masing dalam
 * satu transaksi. Galat melempar dan me-rollback migrasi itu. Tahan balapan: bila instance lain
 * menerapkan versi yang sama lebih dulu, migrasi itu dianggap selesai (tidak melempar).
 */
export async function migrate(db: Db, list: Migration[] = migrations): Promise<string[]> {
	await db.execute(
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		)`
	);
	const isDone = async (q: Queryable, version: string) =>
		(await scalar(q, 'SELECT 1 FROM schema_migrations WHERE version = ?', [version])) !== null;
	const applied: string[] = [];
	for (const m of [...list].sort((a, b) => a.version.localeCompare(b.version))) {
		if (await isDone(db, m.version)) continue;
		try {
			const didApply = await transaction(db, async (tx) => {
				// Periksa lagi di dalam transaksi tulis: instance lain mungkin sudah menerapkannya.
				if (await isDone(tx, m.version)) return false;
				await (tx as Transaction).executeMultiple(m.sql);
				await run(tx, 'INSERT INTO schema_migrations (version) VALUES (?)', [m.version]);
				return true;
			});
			if (didApply) applied.push(m.version);
		} catch (err) {
			// Kalah balapan: versi sudah tercatat oleh instance lain, jadi bukan galat.
			if (await isDone(db, m.version)) continue;
			throw err;
		}
	}
	return applied;
}

/** Target database dari env: `DATABASE_URL` (libsql://…, file:…), selain itu berkas lokal `DATABASE_PATH`. */
export function databaseTarget(env: Record<string, string | undefined> = process.env): string {
	if (env.DATABASE_URL) return env.DATABASE_URL;
	if (env.VERCEL) throw new Error('DATABASE_URL wajib diset di Vercel (mis. libsql://<nama>.turso.io).');
	return env.DATABASE_PATH || './data/app.db';
}

/** `:memory:`, URL libSQL (`libsql:`, `https:`, `file:` …), atau path berkas biasa → URL libSQL. */
export function toDatabaseUrl(target: string): string {
	if (target === ':memory:' || /^(libsql|https?|wss?|file):/.test(target)) return target;
	return `file:${target}`;
}

/** Lama menunggu kunci berkas SQLite (beberapa proses/pekerja dapat menulis ke berkas yang sama). */
export const BUSY_TIMEOUT_MS = 8000;

/**
 * Buka database (buat direktori untuk berkas lokal, aktifkan WAL + foreign keys), lalu migrasi.
 * `target` boleh path berkas, `:memory:`, atau URL libSQL; `authToken` dipakai untuk Turso.
 */
export async function openDatabase(target: string, list: Migration[] = migrations, authToken?: string): Promise<Db> {
	const url = toDatabaseUrl(target);
	if (url.startsWith('file:')) mkdirSync(dirname(url.slice('file:'.length)), { recursive: true });
	const isFile = url.startsWith('file:');
	// `timeout` (busy timeout) berlaku untuk SETIAP koneksi yang dibuka klien. `PRAGMA busy_timeout` hanya menyentuh
	// satu koneksi di kolam, sehingga permintaan paralel yang memakai koneksi lain gagal seketika dengan SQLITE_BUSY.
	const db = createClient({ url, authToken: authToken || undefined, ...(isFile ? { timeout: BUSY_TIMEOUT_MS } : {}) });
	try {
		if (isFile) await db.execute('PRAGMA journal_mode = WAL');
		await db.execute('PRAGMA foreign_keys = ON');
		await migrate(db, list);
	} catch (err) {
		db.close();
		throw err;
	}
	return db;
}
