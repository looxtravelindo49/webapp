import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate, migrations, openDatabase, type Db } from './db';
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
function open(path: string, list = migrations) {
	const db = openDatabase(path, list);
	dbs.push(db);
	return db;
}

afterEach(() => {
	for (const db of dbs.splice(0)) if (db.open) db.close();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const insertPackage = (db: Db, slug: string, extra = '') =>
	db.exec(`INSERT INTO package (slug, title, summary${extra ? ', ' + extra.split('=')[0] : ''})
		VALUES ('${slug}', '${slug}', 's'${extra ? ', ' + extra.split('=')[1] : ''})`);

describe('migrasi', () => {
	it('membuat database baru dan mencatat setiap versi', () => {
		const path = tempPath();
		const db = open(path);
		const versions = db.prepare('SELECT version FROM schema_migrations ORDER BY version').pluck().all();
		expect(versions).toEqual(migrations.map((m) => m.version));
		expect(versions).toContain('0001_init');
		expect(db.prepare("SELECT name FROM sqlite_master WHERE name IN ('package','setting')").all()).toHaveLength(2);
	});

	it('tidak menjalankan migrasi lagi saat start ulang', () => {
		const path = tempPath();
		open(path).close();
		const db = open(path);
		expect(migrate(db)).toEqual([]);
		expect(db.prepare('SELECT COUNT(*) FROM schema_migrations').pluck().get()).toBe(migrations.length);
	});

	it('me-rollback migrasi yang gagal dan melempar galat', () => {
		const path = tempPath();
		const list = [
			{ version: '0001_ok', sql: 'CREATE TABLE ok (x INTEGER);' },
			{ version: '0002_bad', sql: 'CREATE TABLE half (x INTEGER); INSERT INTO tidak_ada VALUES (1);' }
		];
		expect(() => openDatabase(path, list)).toThrow();
		const raw = openDatabase(path, [list[0]]);
		dbs.push(raw);
		const names = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all();
		expect(names).toContain('ok');
		expect(names).not.toContain('half');
		expect(raw.prepare('SELECT version FROM schema_migrations').pluck().all()).toEqual(['0001_ok']);
	});

	it('membuat direktori induk dan mengaktifkan WAL serta foreign keys', () => {
		const path = tempPath('belum/ada');
		const db = open(path);
		expect(existsSync(path)).toBe(true);
		expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
		expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
	});
});

describe('seed', () => {
	it('mengisi lima paket berurutan dengan harga NULL dan min_pax 1', () => {
		const db = open(':memory:');
		seed(db);
		const rows = listPublishedPackages(db);
		expect(rows.map((r) => r.title)).toEqual(['Offroad', 'Team Building', 'Rafting', 'Paintball', 'Fun Games']);
		expect(rows.every((r) => r.price_per_person === null && r.min_pax === 1)).toBe(true);
		expect(rows.map((r) => r.sort_order)).toEqual([1, 2, 3, 4, 5]);
	});

	it('mengisi pengaturan whatsapp awal', () => {
		const db = open(':memory:');
		seed(db);
		expect(getSetting(db, 'whatsapp')).toBe('6282120209900');
		expect(getSetting(db, 'tidak-ada')).toBeNull();
	});

	it('tidak menimpa data yang sudah diedit saat dijalankan ulang', () => {
		const db = open(':memory:');
		seed(db);
		db.prepare("UPDATE package SET price_per_person = 250000 WHERE slug = 'offroad'").run();
		db.prepare("UPDATE setting SET value = '6281234567890' WHERE key = 'whatsapp'").run();
		seed(db);
		expect(db.prepare("SELECT price_per_person FROM package WHERE slug = 'offroad'").pluck().get()).toBe(250000);
		expect(db.prepare('SELECT COUNT(*) FROM package').pluck().get()).toBe(seedPackages.length);
		expect(getSetting(db, 'whatsapp')).toBe('6281234567890');
	});

	it('tidak membuat ulang paket yang dihapus selama tabel tidak kosong', () => {
		const db = open(':memory:');
		seed(db);
		db.prepare("DELETE FROM package WHERE slug != 'offroad'").run();
		seed(db);
		expect(db.prepare('SELECT COUNT(*) FROM package').pluck().get()).toBe(1);
	});
});

describe('constraint tabel package', () => {
	it('menolak harga negatif', () => {
		const db = open(':memory:');
		expect(() => insertPackage(db, 'a', 'price_per_person=-1')).toThrow(/CHECK/);
	});

	it('mengizinkan harga NULL dan min_pax default 1', () => {
		const db = open(':memory:');
		insertPackage(db, 'a');
		const row = db.prepare("SELECT price_per_person, min_pax FROM package WHERE slug = 'a'").get();
		expect(row).toEqual({ price_per_person: null, min_pax: 1 });
	});

	it('menolak min_pax kurang dari 1', () => {
		const db = open(':memory:');
		expect(() => insertPackage(db, 'a', 'min_pax=0')).toThrow(/CHECK/);
	});

	it('menolak slug ganda', () => {
		const db = open(':memory:');
		insertPackage(db, 'a');
		expect(() => insertPackage(db, 'a')).toThrow(/UNIQUE/);
	});
});

describe('listPublishedPackages', () => {
	it('menyembunyikan draft dan mengikuti sort_order lalu id', () => {
		const db = open(':memory:');
		seed(db);
		db.prepare("UPDATE package SET published = 0 WHERE slug = 'rafting'").run();
		db.prepare("UPDATE package SET sort_order = 0 WHERE slug = 'paintball'").run();
		expect(listPublishedPackages(db).map((p) => p.slug)).toEqual([
			'paintball',
			'offroad',
			'team-building',
			'fun-games'
		]);
	});

	it('mengembalikan daftar kosong bila semua draft', () => {
		const db = open(':memory:');
		seed(db);
		db.prepare('UPDATE package SET published = 0').run();
		expect(listPublishedPackages(db)).toEqual([]);
	});
});
