import { afterEach, describe, expect, it } from 'vitest';
import { run, openDatabase, type Db } from './db';
import { createSession, getSessionUser } from './sessions';
import {
	countUsers,
	createUser,
	deleteUser,
	findUserById,
	findUserByLogin,
	listUsers,
	normalizeLogin,
	recordLogin,
	resetPassword,
	setPassword,
	validateLogin
} from './users';

const dbs: Db[] = [];
const fresh = async () => {
	const db = await openDatabase(':memory:');
	dbs.push(db);
	return db;
};
afterEach(() => dbs.splice(0).forEach((d) => d.close()));

const make = async (db: Db, login: string, mustChange = false) => {
	const r = await createUser(db, { login, passwordHash: 'hash-' + login, mustChangePassword: mustChange });
	if (!r.ok) throw new Error(r.message);
	return r.user;
};

describe('id tidak valid', () => {
	it.each([NaN, Infinity, 1.5])('findUserById(%s) → null tanpa melempar', async (id) => {
		expect(await findUserById(await fresh(), id)).toBeNull();
	});
	it('reset dan hapus akun dengan id NaN → tidak ditemukan', async () => {
		const db = await fresh();
		const a = await make(db, 'a-user');
		expect(await resetPassword(db, a.id, NaN, 'h')).toMatchObject({ ok: false, error: 'notfound' });
		expect(await deleteUser(db, a.id, NaN)).toMatchObject({ ok: false, error: 'notfound' });
	});
});

describe('login', () => {
	it('normalizeLogin memangkas dan mengecilkan huruf', async () => {
		expect(normalizeLogin('  Admin@Looxtravel ')).toBe('admin@looxtravel');
	});

	it.each(['admin@looxtravel', 'abc', 'a.b_c-d@e', 'x'.repeat(64), '123'])('login valid %j', (l) => {
		expect(validateLogin(l)).toBeNull();
	});

	it.each(['ab', 'x'.repeat(65), 'ada spasi', 'tanda!', 'Huruf-Besar', '', 'tab\there', 'ñandú', 'a/b'])(
		'login tidak valid %j',
		(l) => {
			expect(validateLogin(l)).not.toBeNull();
		}
	);
});

describe('createUser', () => {
	it('membuat akun dengan login dinormalisasi', async () => {
		const db = await fresh();
		const r = await createUser(db, { login: ' Budi.Santoso ', passwordHash: 'h', mustChangePassword: true });
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.user.login).toBe('budi.santoso');
			expect(r.user.must_change_password).toBe(1);
			expect(r.user.last_login_at).toBeNull();
		}
	});

	it('menolak login yang sudah dipakai tanpa memandang huruf besar-kecil', async () => {
		const db = await fresh();
		await make(db, 'admin@looxtravel');
		const r = await createUser(db, { login: 'ADMIN@looxtravel', passwordHash: 'h', mustChangePassword: false });
		expect(r).toMatchObject({ ok: false, error: 'taken', message: 'Login sudah dipakai.' });
		expect(await countUsers(db)).toBe(1);
	});

	it('batas UNIQUE database juga menolak (pengaman kedua)', async () => {
		const db = await fresh();
		await make(db, 'Admin'.toLowerCase());
		await expect(run(db, 'INSERT INTO user (login, password_hash) VALUES (?, ?)', ['ADMIN', 'h'])).rejects.toThrow(/UNIQUE/);
	});

	it('menolak login tidak valid', async () => {
		const db = await fresh();
		expect(await createUser(db, { login: 'a b', passwordHash: 'h', mustChangePassword: false })).toMatchObject({ ok: false, error: 'invalid' });
		expect(await countUsers(db)).toBe(0);
	});

	it('findUserByLogin tidak memandang huruf besar-kecil dan spasi', async () => {
		const db = await fresh();
		await make(db, 'budi');
		expect((await findUserByLogin(db, '  BUDI '))?.login).toBe('budi');
		expect(await findUserByLogin(db, 'tidak-ada')).toBeNull();
	});

	it('listUsers berurutan menurut tanggal dibuat lalu id', async () => {
		const db = await fresh();
		await make(db, 'c-user');
		await make(db, 'a-user');
		await make(db, 'b-user');
		expect((await listUsers(db)).map((u) => u.login)).toEqual(['c-user', 'a-user', 'b-user']);
	});
});

describe('setPassword / recordLogin', () => {
	it('mengganti hash dan penanda wajib ganti', async () => {
		const db = await fresh();
		const u = await make(db, 'budi', true);
		await setPassword(db, u.id, 'hash-baru', false);
		const after = (await findUserByLogin(db, 'budi'))!;
		expect(after.password_hash).toBe('hash-baru');
		expect(after.must_change_password).toBe(0);
	});

	it('recordLogin mengisi last_login_at', async () => {
		const db = await fresh();
		const u = await make(db, 'budi');
		await recordLogin(db, u.id, new Date('2026-10-17T10:00:00Z'));
		expect((await findUserByLogin(db, 'budi'))!.last_login_at).toBe('2026-10-17T10:00:00.000Z');
	});
});

describe('resetPassword', () => {
	it('mengatur hash baru, wajib ganti, dan mencabut semua sesi target saja', async () => {
		const db = await fresh();
		const admin = await make(db, 'admin-x');
		const budi = await make(db, 'budi');
		const sb = await createSession(db, budi.id);
		const sa = await createSession(db, admin.id);
		const r = await resetPassword(db, admin.id, budi.id, 'hash-reset');
		expect(r).toEqual({ ok: true });
		const after = (await findUserByLogin(db, 'budi'))!;
		expect(after.password_hash).toBe('hash-reset');
		expect(after.must_change_password).toBe(1);
		expect(await getSessionUser(db, sb.token)).toBeNull();
		expect(await getSessionUser(db, sa.token)).not.toBeNull();
	});

	it('menolak reset akun sendiri', async () => {
		const db = await fresh();
		const admin = await make(db, 'admin-x');
		const r = await resetPassword(db, admin.id, admin.id, 'hash-reset');
		expect(r).toMatchObject({ ok: false, error: 'self' });
		expect((await findUserByLogin(db, 'admin-x'))!.password_hash).toBe('hash-admin-x');
	});

	it('akun tidak ditemukan', async () => {
		const db = await fresh();
		const admin = await make(db, 'admin-x');
		expect(await resetPassword(db, admin.id, 999, 'h')).toMatchObject({ ok: false, error: 'notfound' });
	});
});

describe('deleteUser', () => {
	it('menghapus akun lain beserta sesinya', async () => {
		const db = await fresh();
		const admin = await make(db, 'admin-x');
		const budi = await make(db, 'budi');
		const s = await createSession(db, budi.id);
		expect(await deleteUser(db, admin.id, budi.id)).toEqual({ ok: true });
		expect(await findUserByLogin(db, 'budi')).toBeNull();
		expect(await getSessionUser(db, s.token)).toBeNull();
		expect(await countUsers(db)).toBe(1);
	});

	it('menolak menghapus diri sendiri', async () => {
		const db = await fresh();
		const admin = await make(db, 'admin-x');
		await make(db, 'budi');
		expect(await deleteUser(db, admin.id, admin.id)).toMatchObject({ ok: false, error: 'self' });
		expect(await countUsers(db)).toBe(2);
	});

	it('menolak meninggalkan nol akun, bahkan bila pelaku bukan akun itu (permintaan langsung)', async () => {
		const db = await fresh();
		const only = await make(db, 'satu-satunya');
		expect(await deleteUser(db, 12345, only.id)).toMatchObject({ ok: false, error: 'last' });
		expect(await countUsers(db)).toBe(1);
	});

	it('akun tidak ditemukan', async () => {
		const db = await fresh();
		const admin = await make(db, 'admin-x');
		expect(await deleteUser(db, admin.id, 999)).toMatchObject({ ok: false, error: 'notfound' });
	});
});
