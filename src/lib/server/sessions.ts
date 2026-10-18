import { createHash, randomBytes } from 'node:crypto';
import { one, run, type Queryable } from './db';
import type { User } from './users';

export const SESSION_COOKIE = 'session';
export const SESSION_DAYS = 7;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

/** Hanya hash token yang disimpan; kebocoran database tidak membocorkan sesi aktif. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const iso = (d: Date) => d.toISOString();

export async function createSession(db: Queryable, userId: number, now: Date = new Date()) {
	// Bersihkan sesi kedaluwarsa milik siapa pun pada kesempatan ini.
	await run(db, 'DELETE FROM session WHERE expires_at <= ?', [iso(now)]);
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
	await run(db, 'INSERT INTO session (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
		hashToken(token),
		userId,
		iso(now),
		iso(expiresAt)
	]);
	return { token, expiresAt };
}

/** Pengguna untuk token sesi yang valid; sesi kedaluwarsa dihapus dan dianggap tidak ada. */
export async function getSessionUser(db: Queryable, token: string, now: Date = new Date()): Promise<User | null> {
	const id = hashToken(token);
	const row = await one<User & { expires_at: string }>(
		db,
		`SELECT s.expires_at AS expires_at, u.* FROM session s
		 JOIN user u ON u.id = s.user_id WHERE s.id = ?`,
		[id]
	);
	if (!row) return null;
	if (row.expires_at <= iso(now)) {
		await run(db, 'DELETE FROM session WHERE id = ?', [id]);
		return null;
	}
	const { expires_at: _expires, ...user } = row;
	return user;
}

export async function deleteSession(db: Queryable, token: string): Promise<void> {
	await run(db, 'DELETE FROM session WHERE id = ?', [hashToken(token)]);
}

/** Hapus semua sesi pengguna, kecuali sesi dengan token `exceptToken` bila diberikan. */
export async function deleteUserSessions(db: Queryable, userId: number, exceptToken?: string): Promise<void> {
	if (exceptToken) {
		await run(db, 'DELETE FROM session WHERE user_id = ? AND id != ?', [userId, hashToken(exceptToken)]);
	} else {
		await run(db, 'DELETE FROM session WHERE user_id = ?', [userId]);
	}
}
