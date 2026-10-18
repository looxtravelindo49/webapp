import { createHash, randomBytes } from 'node:crypto';
import type { Db } from './db';
import type { User } from './users';

export const SESSION_COOKIE = 'session';
export const SESSION_DAYS = 7;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

/** Hanya hash token yang disimpan; kebocoran database tidak membocorkan sesi aktif. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const iso = (d: Date) => d.toISOString();

export function createSession(db: Db, userId: number, now: Date = new Date()) {
	// Bersihkan sesi kedaluwarsa milik siapa pun pada kesempatan ini.
	db.prepare('DELETE FROM session WHERE expires_at <= ?').run(iso(now));
	const token = randomBytes(32).toString('base64url');
	const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
	db.prepare('INSERT INTO session (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
		hashToken(token),
		userId,
		iso(now),
		iso(expiresAt)
	);
	return { token, expiresAt };
}

/** Pengguna untuk token sesi yang valid; sesi kedaluwarsa dihapus dan dianggap tidak ada. */
export function getSessionUser(db: Db, token: string, now: Date = new Date()): User | null {
	const id = hashToken(token);
	const row = db
		.prepare(
			`SELECT s.expires_at AS expires_at, u.* FROM session s
			 JOIN user u ON u.id = s.user_id WHERE s.id = ?`
		)
		.get(id) as (User & { expires_at: string }) | undefined;
	if (!row) return null;
	if (row.expires_at <= iso(now)) {
		db.prepare('DELETE FROM session WHERE id = ?').run(id);
		return null;
	}
	const { expires_at: _expires, ...user } = row;
	return user;
}

export function deleteSession(db: Db, token: string): void {
	db.prepare('DELETE FROM session WHERE id = ?').run(hashToken(token));
}

/** Hapus semua sesi pengguna, kecuali sesi dengan token `exceptToken` bila diberikan. */
export function deleteUserSessions(db: Db, userId: number, exceptToken?: string): void {
	if (exceptToken) {
		db.prepare('DELETE FROM session WHERE user_id = ? AND id != ?').run(userId, hashToken(exceptToken));
	} else {
		db.prepare('DELETE FROM session WHERE user_id = ?').run(userId);
	}
}
