import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './db';
import { createSession, deleteSession, deleteUserSessions, getSessionUser, hashToken, SESSION_MAX_AGE_SECONDS } from './sessions';
import { createUser } from './users';

const dbs: Db[] = [];
function setup() {
	const db = openDatabase(':memory:');
	dbs.push(db);
	const a = createUser(db, { login: 'a-user', passwordHash: 'h', mustChangePassword: false });
	const b = createUser(db, { login: 'b-user', passwordHash: 'h', mustChangePassword: false });
	if (!a.ok || !b.ok) throw new Error('setup');
	return { db, a: a.user, b: b.user };
}
afterEach(() => dbs.splice(0).forEach((d) => d.open && d.close()));

const t0 = new Date('2026-10-17T10:00:00Z');
const plus = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

describe('sessions', () => {
	it('membuat token acak 32 byte dan menyimpan hanya hash-nya', () => {
		const { db, a } = setup();
		const { token } = createSession(db, a.id, t0);
		expect(Buffer.from(token, 'base64url')).toHaveLength(32);
		const ids = db.prepare('SELECT id FROM session').pluck().all();
		expect(ids).toEqual([hashToken(token)]);
		expect(ids).not.toContain(token);
		expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
	});

	it('token berbeda untuk setiap sesi', () => {
		const { db, a } = setup();
		expect(createSession(db, a.id, t0).token).not.toBe(createSession(db, a.id, t0).token);
	});

	it('masa berlaku 7 hari', () => {
		const { db, a } = setup();
		const { expiresAt } = createSession(db, a.id, t0);
		expect(SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 3600);
		expect(expiresAt.getTime() - t0.getTime()).toBe(7 * 24 * 3600 * 1000);
	});

	it('mengembalikan pengguna untuk token valid', () => {
		const { db, a } = setup();
		const { token } = createSession(db, a.id, t0);
		expect(getSessionUser(db, token, plus(t0, 60))?.login).toBe('a-user');
	});

	it('menolak token tidak dikenal', () => {
		const { db } = setup();
		expect(getSessionUser(db, 'acak-tidak-ada', t0)).toBeNull();
		expect(getSessionUser(db, '', t0)).toBeNull();
	});

	it('menolak dan menghapus sesi kedaluwarsa', () => {
		const { db, a } = setup();
		const { token } = createSession(db, a.id, t0);
		expect(getSessionUser(db, token, plus(t0, SESSION_MAX_AGE_SECONDS - 1))).not.toBeNull();
		expect(getSessionUser(db, token, plus(t0, SESSION_MAX_AGE_SECONDS))).toBeNull();
		expect(db.prepare('SELECT COUNT(*) FROM session').pluck().get()).toBe(0);
	});

	it('membersihkan sesi kedaluwarsa milik siapa pun saat membuat sesi baru', () => {
		const { db, a, b } = setup();
		createSession(db, a.id, t0);
		createSession(db, b.id, t0);
		createSession(db, a.id, plus(t0, SESSION_MAX_AGE_SECONDS + 10));
		expect(db.prepare('SELECT COUNT(*) FROM session').pluck().get()).toBe(1);
	});

	it('deleteSession menghapus satu sesi', () => {
		const { db, a } = setup();
		const s1 = createSession(db, a.id, t0);
		const s2 = createSession(db, a.id, t0);
		deleteSession(db, s1.token);
		expect(getSessionUser(db, s1.token, t0)).toBeNull();
		expect(getSessionUser(db, s2.token, t0)).not.toBeNull();
	});

	it('deleteUserSessions menghapus semua sesi pengguna, atau semua kecuali satu', () => {
		const { db, a, b } = setup();
		const a1 = createSession(db, a.id, t0);
		const a2 = createSession(db, a.id, t0);
		const b1 = createSession(db, b.id, t0);
		deleteUserSessions(db, a.id, a1.token);
		expect(getSessionUser(db, a1.token, t0)).not.toBeNull();
		expect(getSessionUser(db, a2.token, t0)).toBeNull();
		deleteUserSessions(db, a.id);
		expect(getSessionUser(db, a1.token, t0)).toBeNull();
		expect(getSessionUser(db, b1.token, t0)).not.toBeNull();
	});

	it('sesi ikut terhapus bersama akun (CASCADE)', () => {
		const { db, a } = setup();
		const { token } = createSession(db, a.id, t0);
		db.prepare('DELETE FROM user WHERE id = ?').run(a.id);
		expect(getSessionUser(db, token, t0)).toBeNull();
		expect(db.prepare('SELECT COUNT(*) FROM session').pluck().get()).toBe(0);
	});
});
