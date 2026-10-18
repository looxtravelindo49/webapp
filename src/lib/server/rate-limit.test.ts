import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, scalar, toDatabaseUrl, type Db } from './db';
import { LoginLimiter } from './rate-limit';

const MIN = 60_000;

const dbs: Db[] = [];
const dirs: string[] = [];
const fresh = async () => {
	const db = await openDatabase(':memory:');
	dbs.push(db);
	return { db, l: new LoginLimiter(db) };
};
afterEach(() => {
	dbs.splice(0).forEach((d) => d.close());
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('LoginLimiter', () => {
	it('mengizinkan sampai 5 kegagalan lalu mengunci percobaan berikutnya', async () => {
		const { l } = await fresh();
		for (let i = 0; i < 5; i++) {
			expect((await l.check('a|1', 0)).allowed).toBe(true);
			await l.fail('a|1', i * 1000);
		}
		const r = await l.check('a|1', 6000);
		expect(r.allowed).toBe(false);
		if (!r.allowed) expect(r.retryAfterSeconds).toBe(Math.ceil((15 * MIN - 6000) / 1000));
	});

	it('empat kegagalan belum mengunci', async () => {
		const { l } = await fresh();
		for (let i = 0; i < 4; i++) await l.fail('a|1', i);
		expect((await l.check('a|1', 10)).allowed).toBe(true);
	});

	it('login berhasil mereset hitungan', async () => {
		const { l } = await fresh();
		for (let i = 0; i < 4; i++) await l.fail('a|1', i);
		await l.succeed('a|1');
		for (let i = 0; i < 4; i++) await l.fail('a|1', 100 + i);
		expect((await l.check('a|1', 200)).allowed).toBe(true);
	});

	it('jendela berakhir setelah 15 menit', async () => {
		const { l } = await fresh();
		for (let i = 0; i < 5; i++) await l.fail('a|1', 0);
		expect((await l.check('a|1', 15 * MIN - 1)).allowed).toBe(false);
		expect((await l.check('a|1', 15 * MIN)).allowed).toBe(true);
		await l.fail('a|1', 15 * MIN + 1);
		expect((await l.check('a|1', 15 * MIN + 2)).allowed).toBe(true); // hitungan baru dimulai dari 1
	});

	it('jendela baru benar-benar dimulai dari 1, bukan melanjutkan hitungan lama', async () => {
		const { l, db } = await fresh();
		for (let i = 0; i < 5; i++) await l.fail('a|1', 0);
		await l.fail('a|1', 15 * MIN + 5);
		expect(await scalar(db, "SELECT count FROM login_attempt WHERE key = 'a|1'")).toBe(1);
		expect(await scalar(db, "SELECT window_start FROM login_attempt WHERE key = 'a|1'")).toBe(15 * MIN + 5);
	});

	it('kunci lain tidak terpengaruh (login atau IP berbeda)', async () => {
		const { l } = await fresh();
		for (let i = 0; i < 5; i++) await l.fail('a|1', 0);
		expect((await l.check('b|1', 1)).allowed).toBe(true);
		expect((await l.check('a|2', 1)).allowed).toBe(true);
	});

	it('percobaan yang ditolak tidak memperpanjang jendela', async () => {
		const { l } = await fresh();
		for (let i = 0; i < 5; i++) await l.fail('a|1', 0);
		await l.check('a|1', 10 * MIN);
		expect((await l.check('a|1', 15 * MIN)).allowed).toBe(true);
	});

	it('retryAfter minimal 1 detik', async () => {
		const { l } = await fresh();
		for (let i = 0; i < 5; i++) await l.fail('a|1', 0);
		const r = await l.check('a|1', 15 * MIN - 1);
		expect(r.allowed).toBe(false);
		if (!r.allowed) expect(r.retryAfterSeconds).toBe(1);
	});

	it('membersihkan jendela lama agar tabel tidak tumbuh tanpa batas', async () => {
		const { l, db } = await fresh();
		for (let i = 0; i < 600; i++) await l.fail(`k${i}|1`, 0);
		await l.fail('baru|1', 20 * MIN);
		expect(await scalar<number>(db, 'SELECT COUNT(*) FROM login_attempt')).toBeLessThan(10);
	});
});

describe('LoginLimiter dibagi antar instance dan bertahan lintas restart', () => {
	function tempFile() {
		const dir = mkdtempSync(join(tmpdir(), 'lembang-rl-'));
		dirs.push(dir);
		return join(dir, 'app.db');
	}

	it('hitungan dari satu instance berlaku di instance lain pada database yang sama', async () => {
		const path = tempFile();
		const a = await openDatabase(path);
		const b = createClient({ url: toDatabaseUrl(path) });
		dbs.push(a, b);
		const la = new LoginLimiter(a);
		const lb = new LoginLimiter(b);
		for (let i = 0; i < 5; i++) await la.fail('a|1', i);
		expect((await lb.check('a|1', 10)).allowed).toBe(false);
		await lb.succeed('a|1');
		expect((await la.check('a|1', 11)).allowed).toBe(true);
	});

	it('hitungan bertahan setelah database ditutup dan dibuka lagi (restart)', async () => {
		const path = tempFile();
		const first = await openDatabase(path);
		for (let i = 0; i < 5; i++) await new LoginLimiter(first).fail('a|1', i);
		first.close();
		const second = await openDatabase(path);
		dbs.push(second);
		expect((await new LoginLimiter(second).check('a|1', 100)).allowed).toBe(false);
	});
});
