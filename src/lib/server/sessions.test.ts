import { afterEach, describe, expect, it } from 'vitest';
import { run, column, scalar, openDatabase, type Db } from './db';
import { createSession, deleteSession, deleteUserSessions, getSessionUser, hashToken, SESSION_MAX_AGE_SECONDS } from './sessions';
import { createUser } from './users';

const dbs: Db[] = [];
async function setup() {
	const db = await openDatabase(':memory:');
	dbs.push(db);
	const a = await createUser(db, { login: 'a-user', passwordHash: 'h', mustChangePassword: false });
	const b = await createUser(db, { login: 'b-user', passwordHash: 'h', mustChangePassword: false });
	if (!a.ok || !b.ok) throw new Error('setup');
	return { db, a: a.user, b: b.user };
}
afterEach(() => dbs.splice(0).forEach((d) => d.close()));

const t0 = new Date('2026-10-17T10:00:00Z');
const plus = (d: Date, s: number) => new Date(d.getTime() + s * 1000);

describe('sessions', () => {
	it('membuat token acak 32 byte dan menyimpan hanya hash-nya', async () => {
		const { db, a } = await setup();
		const { token } = await createSession(db, a.id, t0);
		expect(Buffer.from(token, 'base64url')).toHaveLength(32);
		const ids = (await column(db, 'SELECT id FROM session'));
		expect(ids).toEqual([hashToken(token)]);
		expect(ids).not.toContain(token);
		expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
	});

	it('token berbeda untuk setiap sesi', async () => {
		const { db, a } = await setup();
		expect((await createSession(db, a.id, t0)).token).not.toBe((await createSession(db, a.id, t0)).token);
	});

	it('masa berlaku 7 hari', async () => {
		const { db, a } = await setup();
		const { expiresAt } = await createSession(db, a.id, t0);
		expect(SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 3600);
		expect(expiresAt.getTime() - t0.getTime()).toBe(7 * 24 * 3600 * 1000);
	});

	it('mengembalikan pengguna untuk token valid', async () => {
		const { db, a } = await setup();
		const { token } = await createSession(db, a.id, t0);
		expect((await getSessionUser(db, token, plus(t0, 60)))?.login).toBe('a-user');
	});

	it('menolak token tidak dikenal', async () => {
		const { db } = await setup();
		expect(await getSessionUser(db, 'acak-tidak-ada', t0)).toBeNull();
		expect(await getSessionUser(db, '', t0)).toBeNull();
	});

	it('menolak dan menghapus sesi kedaluwarsa', async () => {
		const { db, a } = await setup();
		const { token } = await createSession(db, a.id, t0);
		expect(await getSessionUser(db, token, plus(t0, SESSION_MAX_AGE_SECONDS - 1))).not.toBeNull();
		expect(await getSessionUser(db, token, plus(t0, SESSION_MAX_AGE_SECONDS))).toBeNull();
		expect((await scalar(db, 'SELECT COUNT(*) FROM session'))).toBe(0);
	});

	it('membersihkan sesi kedaluwarsa milik siapa pun saat membuat sesi baru', async () => {
		const { db, a, b } = await setup();
		await createSession(db, a.id, t0);
		await createSession(db, b.id, t0);
		await createSession(db, a.id, plus(t0, SESSION_MAX_AGE_SECONDS + 10));
		expect((await scalar(db, 'SELECT COUNT(*) FROM session'))).toBe(1);
	});

	it('deleteSession menghapus satu sesi', async () => {
		const { db, a } = await setup();
		const s1 = await createSession(db, a.id, t0);
		const s2 = await createSession(db, a.id, t0);
		await deleteSession(db, s1.token);
		expect(await getSessionUser(db, s1.token, t0)).toBeNull();
		expect(await getSessionUser(db, s2.token, t0)).not.toBeNull();
	});

	it('deleteUserSessions menghapus semua sesi pengguna, atau semua kecuali satu', async () => {
		const { db, a, b } = await setup();
		const a1 = await createSession(db, a.id, t0);
		const a2 = await createSession(db, a.id, t0);
		const b1 = await createSession(db, b.id, t0);
		await deleteUserSessions(db, a.id, a1.token);
		expect(await getSessionUser(db, a1.token, t0)).not.toBeNull();
		expect(await getSessionUser(db, a2.token, t0)).toBeNull();
		await deleteUserSessions(db, a.id);
		expect(await getSessionUser(db, a1.token, t0)).toBeNull();
		expect(await getSessionUser(db, b1.token, t0)).not.toBeNull();
	});

	it('sesi ikut terhapus bersama akun (CASCADE)', async () => {
		const { db, a } = await setup();
		const { token } = await createSession(db, a.id, t0);
		await run(db, 'DELETE FROM user WHERE id = ?', [a.id]);
		expect(await getSessionUser(db, token, t0)).toBeNull();
		expect((await scalar(db, 'SELECT COUNT(*) FROM session'))).toBe(0);
	});
});
