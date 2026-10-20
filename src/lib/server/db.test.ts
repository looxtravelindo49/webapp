import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createClient } from '@libsql/client';
import { all, column, databaseTarget, migrate, migrations, one, openDatabase, run, scalar, toDatabaseUrl, transaction, type Db } from './db';
import { seed, seedPackages } from './seed';
import { listPublishedPackages } from './packages';
import { getSetting } from './settings';

const dirs: string[] = [];
const dbs: Db[] = [];

function tempPath(sub = '') {
	const dir = mkdtempSync(join(tmpdir(), 'lembang-'));
	dirs.push(dir);
	return join(dir, sub, 'app.db');
}
async function open(path: string, list = migrations) {
	const db = await openDatabase(path, list);
	dbs.push(db);
	return db;
}

afterEach(() => {
	for (const db of dbs.splice(0)) db.close();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const insertPackage = async (db: Db, slug: string, extra = '') =>
	await db.executeMultiple(`INSERT INTO package (slug, title, summary${extra ? ', ' + extra.split('=')[0] : ''})
		VALUES ('${slug}', '${slug}', 's'${extra ? ', ' + extra.split('=')[1] : ''})`);

describe('migrasi', () => {
	it('membuat database baru dan mencatat setiap versi', async () => {
		const path = tempPath();
		const db = await open(path);
		const versions = (await column(db, 'SELECT version FROM schema_migrations ORDER BY version'));
		expect(versions).toEqual(migrations.map((m) => m.version));
		expect(versions).toContain('0001_init');
		expect((await all(db, "SELECT name FROM sqlite_master WHERE name IN ('package','setting')"))).toHaveLength(2);
	});

	it('0003 membuat tabel login_attempt dengan kunci utama dan indeks jendela', async () => {
		const db = await open(':memory:');
		expect(await column(db, "SELECT name FROM sqlite_master WHERE tbl_name = 'login_attempt' ORDER BY name")).toEqual(
			expect.arrayContaining(['login_attempt', 'login_attempt_window'])
		);
		await expect(run(db, "INSERT INTO login_attempt (key, count, window_start) VALUES ('k', 0, 1)")).rejects.toThrow(/CHECK/);
	});

	it('tidak menjalankan migrasi lagi saat start ulang', async () => {
		const path = tempPath();
		(await open(path)).close();
		const db = await open(path);
		expect(await migrate(db)).toEqual([]);
		expect((await scalar(db, 'SELECT COUNT(*) FROM schema_migrations'))).toBe(migrations.length);
	});

	it('me-rollback migrasi yang gagal dan melempar galat', async () => {
		const path = tempPath();
		const list = [
			{ version: '0001_ok', sql: 'CREATE TABLE ok (x INTEGER);' },
			{ version: '0002_bad', sql: 'CREATE TABLE half (x INTEGER); INSERT INTO tidak_ada VALUES (1);' }
		];
		await expect(openDatabase(path, list)).rejects.toThrow();
		const raw = await openDatabase(path, [list[0]]);
		dbs.push(raw);
		const names = (await column(raw, "SELECT name FROM sqlite_master WHERE type = 'table'"));
		expect(names).toContain('ok');
		expect(names).not.toContain('half');
		expect((await column(raw, 'SELECT version FROM schema_migrations'))).toEqual(['0001_ok']);
	});

	it('membuat direktori induk dan mengaktifkan WAL serta foreign keys', async () => {
		const path = tempPath('belum/ada');
		const db = await open(path);
		expect(existsSync(path)).toBe(true);
		expect(await scalar(db, 'PRAGMA journal_mode')).toBe('wal');
		expect(await scalar(db, 'PRAGMA foreign_keys')).toBe(1);
	});
});

/**
 * Simulasi balapan antar instance yang deterministik: sebelum `method` pertama kali dipanggil pada
 * klien ini, `competitor` (instance lain) menyelesaikan kerjanya sampai commit. Driver native bersifat
 * sinkron, jadi dua klien dalam satu proses tidak bisa benar-benar berebut kunci tulis.
 */
function raceBefore(db: Db, method: 'transaction' | 'execute', competitor: () => Promise<unknown>): Db {
	let fired = false;
	return new Proxy(db, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (prop !== method || typeof value !== 'function') return typeof value === 'function' ? value.bind(target) : value;
			return async (...args: unknown[]) => {
				if (!fired) {
					fired = true;
					await competitor();
				}
				return value.apply(target, args);
			};
		}
	});
}

describe('migrasi bersamaan', () => {
	it('instance yang kalah balapan menganggap migrasi selesai dan versi tercatat sekali', async () => {
		const db = createClient({ url: toDatabaseUrl(tempPath()) });
		dbs.push(db);
		// Pemeriksaan awal melihat database kosong; instance lain menerapkan semua migrasi sebelum transaksi kita dimulai.
		const racing = raceBefore(db, 'transaction', async () => {
			await migrate(db);
		});
		expect(await migrate(racing)).toEqual([]);
		expect(await column(db, 'SELECT version FROM schema_migrations ORDER BY version')).toEqual(migrations.map((m) => m.version));
	});

	it('migrasi yang gagal karena instance lain sudah menerapkannya tidak melempar', async () => {
		const path = tempPath();
		const db = createClient({ url: toDatabaseUrl(path) });
		dbs.push(db);
		const list = [{ version: '0001_x', sql: 'CREATE TABLE x (a INTEGER);' }];
		const racing = raceBefore(db, 'transaction', async () => {
			await migrate(db, list); // pemenang menerapkan 0001_x tepat sebelum transaksi kita
		});
		// Transaksi kita memeriksa ulang di dalamnya dan melewati migrasi yang sudah ada.
		expect(await migrate(racing, list)).toEqual([]);
		expect(await scalar(db, 'SELECT COUNT(*) FROM schema_migrations')).toBe(1);
	});

	it('kalah balapan setelah pemeriksaan di dalam transaksi: galat dianggap selesai bila versi sudah tercatat', async () => {
		const db = createClient({ url: toDatabaseUrl(tempPath()) });
		dbs.push(db);
		const list = [{ version: '0001_x', sql: 'CREATE TABLE x (a INTEGER);' }];
		// Transaksi tiruan: pemeriksaan di dalamnya tidak melihat versi (kalah balapan tipis), SQL-nya gagal
		// karena tabelnya sudah dibuat pemenang, dan pemenang sudah mencatat versinya di database nyata.
		const stubTx = {
			execute: async () => ({ rows: [], columns: [], rowsAffected: 0, lastInsertRowid: undefined }),
			executeMultiple: async () => { throw new Error('table x already exists'); },
			rollback: async () => {},
			commit: async () => {},
			close: () => {}
		};
		const withStub = new Proxy(db, {
			get(target, prop, receiver) {
				if (prop === 'transaction') {
					return async () => {
						await migrate(db, list); // pemenang menyelesaikan migrasi sebelum transaksi tiruan kita dipakai
						return stubTx;
					};
				}
				const v = Reflect.get(target, prop, receiver);
				return typeof v === 'function' ? v.bind(target) : v;
			}
		});
		expect(await migrate(withStub, list)).toEqual([]);
	});

	it('migrasi yang benar-benar rusak tetap melempar walau tidak ada pemenang', async () => {
		const db = await open(':memory:', []);
		await expect(migrate(db, [{ version: '0001_bad', sql: 'INSERT INTO tidak_ada VALUES (1);' }])).rejects.toThrow();
		expect(await scalar(db, 'SELECT COUNT(*) FROM schema_migrations')).toBe(0);
	});
});

describe('target database dari environment', () => {
	it('DATABASE_URL mengalahkan DATABASE_PATH', () => {
		expect(databaseTarget({ DATABASE_URL: 'libsql://x.turso.io', DATABASE_PATH: '/tmp/a.db' })).toBe('libsql://x.turso.io');
	});
	it('tanpa DATABASE_URL memakai DATABASE_PATH, lalu ./data/app.db', () => {
		expect(databaseTarget({ DATABASE_PATH: '/tmp/x/app.db' })).toBe('/tmp/x/app.db');
		expect(databaseTarget({})).toBe('./data/app.db');
	});
	it('di Vercel tanpa DATABASE_URL gagal dengan pesan yang menyebut DATABASE_URL', () => {
		expect(() => databaseTarget({ VERCEL: '1' })).toThrow(/DATABASE_URL/);
		expect(() => databaseTarget({ VERCEL: '1', DATABASE_PATH: '/tmp/a.db' })).toThrow(/DATABASE_URL/);
	});
	it('path biasa menjadi URL file:, URL libSQL dibiarkan', () => {
		expect(toDatabaseUrl('/tmp/a.db')).toBe('file:/tmp/a.db');
		expect(toDatabaseUrl(':memory:')).toBe(':memory:');
		expect(toDatabaseUrl('libsql://x.turso.io')).toBe('libsql://x.turso.io');
		expect(toDatabaseUrl('file:./a.db')).toBe('file:./a.db');
	});
});

describe('seed', () => {
	it('mengisi lima paket berurutan dengan harga NULL dan min_pax 1', async () => {
		const db = await open(':memory:');
		await seed(db);
		const rows = await listPublishedPackages(db);
		expect(rows.map((r) => r.title)).toEqual(['Offroad', 'Team Building', 'Rafting', 'Paintball', 'Fun Games']);
		expect(rows.every((r) => r.price_per_person === null)).toBe(true);
		expect(rows.map((r) => r.min_pax)).toEqual([7, 20, 5, 10, 20]);
		expect(rows.map((r) => r.pricing_mode)).toEqual(['per_unit', 'per_person', 'per_person', 'per_person', 'per_person']);
		expect(rows[0]).toMatchObject({ kapasitas_per_unit: 7, nama_unit: 'mobil' });
		expect(rows[1].kapasitas_per_unit).toBeNull();
		expect(rows.map((r) => r.duration)).toEqual(['2-3 Jam', null, null, null, null]);
		expect(rows.map((r) => r.sort_order)).toEqual([1, 2, 3, 4, 5]);
	});

	it('mengisi pengaturan whatsapp awal', async () => {
		const db = await open(':memory:');
		await seed(db);
		expect(await getSetting(db, 'whatsapp')).toBe('6282120209900');
		expect(await getSetting(db, 'tidak-ada')).toBeNull();
	});

	it('tidak menimpa data yang sudah diedit saat dijalankan ulang', async () => {
		const db = await open(':memory:');
		await seed(db);
		await run(db, "UPDATE package SET price_per_person = 250000, duration = 'Sehari' WHERE slug = 'offroad'");
		await run(db, "UPDATE setting SET value = '6281234567890' WHERE key = 'whatsapp'");
		await seed(db);
		expect((await scalar(db, "SELECT price_per_person FROM package WHERE slug = 'offroad'"))).toBe(250000);
		expect((await scalar(db, "SELECT duration FROM package WHERE slug = 'offroad'"))).toBe('Sehari');
		expect((await scalar(db, 'SELECT COUNT(*) FROM package'))).toBe(seedPackages.length);
		expect(await getSetting(db, 'whatsapp')).toBe('6281234567890');
	});

	it('instance yang kalah balapan seed tidak melempar dan tidak menggandakan data', async () => {
		const path = tempPath();
		const db = await open(path);
		const racing = raceBefore(db, 'transaction', async () => {
			await seed(db); // instance lain menyelesaikan seed lebih dulu
		});
		await seed(racing);
		expect(await scalar(db, 'SELECT COUNT(*) FROM package')).toBe(seedPackages.length);
		expect(await scalar(db, "SELECT COUNT(*) FROM setting WHERE key = 'whatsapp'")).toBe(1);
	});

	it('tidak membuat ulang paket yang dihapus selama tabel tidak kosong', async () => {
		const db = await open(':memory:');
		await seed(db);
		await run(db, "DELETE FROM package WHERE slug != 'offroad'");
		await seed(db);
		expect((await scalar(db, 'SELECT COUNT(*) FROM package'))).toBe(1);
	});
});

describe('constraint tabel package', () => {
	it('menolak harga negatif', async () => {
		const db = await open(':memory:');
		await expect(insertPackage(db, 'a', 'price_per_person=-1')).rejects.toThrow(/CHECK/);
	});

	it('mengizinkan harga NULL dan min_pax default 1', async () => {
		const db = await open(':memory:');
		await insertPackage(db, 'a');
		const row = (await one(db, "SELECT price_per_person, min_pax FROM package WHERE slug = 'a'"));
		expect(row).toEqual({ price_per_person: null, min_pax: 1 });
	});

	it('menolak min_pax kurang dari 1', async () => {
		const db = await open(':memory:');
		await expect(insertPackage(db, 'a', 'min_pax=0')).rejects.toThrow(/CHECK/);
	});

	it('menolak slug ganda', async () => {
		const db = await open(':memory:');
		await insertPackage(db, 'a');
		await expect(insertPackage(db, 'a')).rejects.toThrow(/UNIQUE/);
	});
});

describe('listPublishedPackages', () => {
	it('menyembunyikan draft dan mengikuti sort_order lalu id', async () => {
		const db = await open(':memory:');
		await seed(db);
		await run(db, "UPDATE package SET published = 0 WHERE slug = 'rafting'");
		await run(db, "UPDATE package SET sort_order = 0 WHERE slug = 'paintball'");
		expect((await listPublishedPackages(db)).map((p) => p.slug)).toEqual([
			'paintball',
			'offroad',
			'team-building',
			'fun-games'
		]);
	});

	it('mengembalikan daftar kosong bila semua draft', async () => {
		const db = await open(':memory:');
		await seed(db);
		await run(db, 'UPDATE package SET published = 0');
		expect(await listPublishedPackages(db)).toEqual([]);
	});
});

describe('busy timeout berkas SQLite', () => {
	/** Proses lain yang memegang kunci tulis `ms` milidetik; proses terpisah karena klien libSQL memblokir saat menunggu. */
	function holdWriteLock(path: string, ms: number) {
		const script = `
			import Database from ${JSON.stringify(new URL('../../../node_modules/better-sqlite3/lib/index.js', import.meta.url).href)};
			const db = new Database(process.argv[1]);
			db.exec('BEGIN IMMEDIATE');
			console.log('locked');
			setTimeout(() => { db.exec('COMMIT'); db.close(); }, ${ms});
		`;
		const child = spawn(process.execPath, ['--input-type=module', '-e', script, path], { stdio: ['ignore', 'pipe', 'inherit'] });
		const locked = new Promise<void>((resolve, reject) => {
			child.stdout.on('data', (d) => String(d).includes('locked') && resolve());
			child.once('error', reject);
			child.once('exit', (code) => code && reject(new Error(`proses penahan kunci berhenti: ${code}`)));
		});
		const done = new Promise<void>((resolve) => child.once('exit', () => resolve()));
		return { locked, done };
	}

	it('koneksi apa pun (termasuk setelah transaction) menunggu kunci, bukan gagal seketika dengan SQLITE_BUSY', async () => {
		const path = tempPath();
		const db = await open(path);
		await run(db, 'CREATE TABLE IF NOT EXISTS busy_probe (n INTEGER)');
		// `transaction()` mengambil koneksi lain dari kolam; koneksi itulah yang dulu tidak punya busy timeout.
		await transaction(db, async (tx) => {
			await run(tx, 'INSERT INTO busy_probe VALUES (0)');
		});

		const holder = holdWriteLock(path, 400);
		await holder.locked;
		const started = Date.now();
		await run(db, 'INSERT INTO busy_probe VALUES (1)');
		expect(Date.now() - started).toBeGreaterThanOrEqual(250);
		await holder.done;
		expect(await scalar(db, 'SELECT COUNT(*) FROM busy_probe')).toBe(2);
	});
});
