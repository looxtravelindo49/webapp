import { run, scalar, type Queryable } from './db';

export async function getSetting(db: Queryable, key: string): Promise<string | null> {
	const value = await scalar(db, 'SELECT value FROM setting WHERE key = ?', [key]);
	return typeof value === 'string' ? value : null;
}

/** Simpan pengaturan (upsert) dan perbarui `updated_at`. */
export async function setSetting(db: Queryable, key: string, value: string): Promise<void> {
	await run(
		db,
		`INSERT INTO setting (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		[key, value]
	);
}
