import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './db';
import { createSession, getSessionUser } from './sessions';
import {
	countUsers,
	createUser,
	deleteUser,
	findUserByLogin,
	listUsers,
	normalizeLogin,
	recordLogin,
	resetPassword,
	setPassword,
	validateLogin
} from './users';

const dbs: Db[] = [];
const fresh = () => {
	const db = openDatabase(':memory:');
	dbs.push(db);
	return db;
};
afterEach(() => dbs.splice(0).forEach((d) => d.open && d.close()));

const make = (db: Db, login: string, mustChange = false) => {
	const r = createUser(db, { login, passwordHash: 'hash-' + login, mustChangePassword: mustChange });
	if (!r.ok) throw new Error(r.message);
	return r.user;
};

describe('login', () => {
	it('normalizeLogin memangkas dan mengecilkan huruf', () => {
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
	it('membuat akun dengan login dinormalisasi', () => {
		const db = fresh();
		const r = createUser(db, { login: ' Budi.Santoso ', passwordHash: 'h', mustChangePassword: true });
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.user.login).toBe('budi.santoso');
			expect(r.user.must_change_password).toBe(1);
			expect(r.user.last_login_at).toBeNull();
		}
	});

	it('menolak login yang sudah dipakai tanpa memandang huruf besar-kecil', () => {
		const db = fresh();
		make(db, 'admin@looxtravel');
		const r = createUser(db, { login: 'ADMIN@looxtravel', passwordHash: 'h', mustChangePassword: false });
		expect(r).toMatchObject({ ok: false, error: 'taken', message: 'Login sudah dipakai.' });
		expect(countUsers(db)).toBe(1);
	});

	it('batas UNIQUE database juga menolak (pengaman kedua)', () => {
		const db = fresh();
		make(db, 'Admin'.toLowerCase());
		expect(() => db.prepare('INSERT INTO user (login, password_hash) VALUES (?, ?)').run('ADMIN', 'h')).toThrow(/UNIQUE/);
	});

	it('menolak login tidak valid', () => {
		const db = fresh();
		expect(createUser(db, { login: 'a b', passwordHash: 'h', mustChangePassword: false })).toMatchObject({ ok: false, error: 'invalid' });
		expect(countUsers(db)).toBe(0);
	});

	it('findUserByLogin tidak memandang huruf besar-kecil dan spasi', () => {
		const db = fresh();
		make(db, 'budi');
		expect(findUserByLogin(db, '  BUDI ')?.login).toBe('budi');
		expect(findUserByLogin(db, 'tidak-ada')).toBeNull();
	});

	it('listUsers berurutan menurut tanggal dibuat lalu id', () => {
		const db = fresh();
		make(db, 'c-user');
		make(db, 'a-user');
		make(db, 'b-user');
		expect(listUsers(db).map((u) => u.login)).toEqual(['c-user', 'a-user', 'b-user']);
	});
});

describe('setPassword / recordLogin', () => {
	it('mengganti hash dan penanda wajib ganti', () => {
		const db = fresh();
		const u = make(db, 'budi', true);
		setPassword(db, u.id, 'hash-baru', false);
		const after = findUserByLogin(db, 'budi')!;
		expect(after.password_hash).toBe('hash-baru');
		expect(after.must_change_password).toBe(0);
	});

	it('recordLogin mengisi last_login_at', () => {
		const db = fresh();
		const u = make(db, 'budi');
		recordLogin(db, u.id, new Date('2026-10-17T10:00:00Z'));
		expect(findUserByLogin(db, 'budi')!.last_login_at).toBe('2026-10-17T10:00:00.000Z');
	});
});

describe('resetPassword', () => {
	it('mengatur hash baru, wajib ganti, dan mencabut semua sesi target saja', () => {
		const db = fresh();
		const admin = make(db, 'admin-x');
		const budi = make(db, 'budi');
		const sb = createSession(db, budi.id);
		const sa = createSession(db, admin.id);
		const r = resetPassword(db, admin.id, budi.id, 'hash-reset');
		expect(r).toEqual({ ok: true });
		const after = findUserByLogin(db, 'budi')!;
		expect(after.password_hash).toBe('hash-reset');
		expect(after.must_change_password).toBe(1);
		expect(getSessionUser(db, sb.token)).toBeNull();
		expect(getSessionUser(db, sa.token)).not.toBeNull();
	});

	it('menolak reset akun sendiri', () => {
		const db = fresh();
		const admin = make(db, 'admin-x');
		const r = resetPassword(db, admin.id, admin.id, 'hash-reset');
		expect(r).toMatchObject({ ok: false, error: 'self' });
		expect(findUserByLogin(db, 'admin-x')!.password_hash).toBe('hash-admin-x');
	});

	it('akun tidak ditemukan', () => {
		const db = fresh();
		const admin = make(db, 'admin-x');
		expect(resetPassword(db, admin.id, 999, 'h')).toMatchObject({ ok: false, error: 'notfound' });
	});
});

describe('deleteUser', () => {
	it('menghapus akun lain beserta sesinya', () => {
		const db = fresh();
		const admin = make(db, 'admin-x');
		const budi = make(db, 'budi');
		const s = createSession(db, budi.id);
		expect(deleteUser(db, admin.id, budi.id)).toEqual({ ok: true });
		expect(findUserByLogin(db, 'budi')).toBeNull();
		expect(getSessionUser(db, s.token)).toBeNull();
		expect(countUsers(db)).toBe(1);
	});

	it('menolak menghapus diri sendiri', () => {
		const db = fresh();
		const admin = make(db, 'admin-x');
		make(db, 'budi');
		expect(deleteUser(db, admin.id, admin.id)).toMatchObject({ ok: false, error: 'self' });
		expect(countUsers(db)).toBe(2);
	});

	it('menolak meninggalkan nol akun, bahkan bila pelaku bukan akun itu (permintaan langsung)', () => {
		const db = fresh();
		const only = make(db, 'satu-satunya');
		expect(deleteUser(db, 12345, only.id)).toMatchObject({ ok: false, error: 'last' });
		expect(countUsers(db)).toBe(1);
	});

	it('akun tidak ditemukan', () => {
		const db = fresh();
		const admin = make(db, 'admin-x');
		expect(deleteUser(db, admin.id, 999)).toMatchObject({ ok: false, error: 'notfound' });
	});
});
