import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = Database.Database;
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

/**
 * Terapkan migrasi yang belum tercatat di `schema_migrations`, berurutan,
 * masing-masing dalam satu transaksi. Galat melempar dan me-rollback migrasi itu.
 */
export function migrate(db: Db, list: Migration[] = migrations): string[] {
	db.exec(
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		)`
	);
	const done = new Set(
		db
			.prepare('SELECT version FROM schema_migrations')
			.pluck()
			.all() as string[]
	);
	const record = db.prepare('INSERT INTO schema_migrations (version) VALUES (?)');
	const applied: string[] = [];
	for (const m of [...list].sort((a, b) => a.version.localeCompare(b.version))) {
		if (done.has(m.version)) continue;
		db.transaction(() => {
			db.exec(m.sql);
			record.run(m.version);
		})();
		applied.push(m.version);
	}
	return applied;
}

/** Buka database (buat direktori bila perlu), aktifkan WAL + foreign keys, lalu migrasi. */
export function openDatabase(path: string, list: Migration[] = migrations): Db {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	try {
		migrate(db, list);
	} catch (err) {
		db.close();
		throw err;
	}
	return db;
}
