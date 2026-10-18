import type { Db } from './db';

export function getSetting(db: Db, key: string): string | null {
	const value = db.prepare('SELECT value FROM setting WHERE key = ?').pluck().get(key);
	return typeof value === 'string' ? value : null;
}

/** Simpan pengaturan (upsert) dan perbarui `updated_at`. */
export function setSetting(db: Db, key: string, value: string): void {
	db.prepare(
		`INSERT INTO setting (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
	).run(key, value);
}
