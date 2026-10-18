import type { Db } from './db';
import { deleteUserSessions } from './sessions';

export type User = {
	id: number;
	login: string;
	password_hash: string;
	must_change_password: number;
	created_at: string;
	updated_at: string;
	last_login_at: string | null;
};

export const LOGIN_PATTERN = /^[a-z0-9@._-]{3,64}$/;

/** Login dibandingkan dalam huruf kecil tanpa spasi di tepi. */
export const normalizeLogin = (raw: string): string => raw.trim().toLowerCase();

/** Pesan kesalahan untuk login (sudah dinormalisasi), atau null bila valid. */
export function validateLogin(login: string): string | null {
	return LOGIN_PATTERN.test(login)
		? null
		: 'Login 3 sampai 64 karakter: huruf, angka, dan @ . _ - saja (tanpa spasi).';
}

export function findUserByLogin(db: Db, login: string): User | null {
	return (db.prepare('SELECT * FROM user WHERE login = ?').get(normalizeLogin(login)) as User | undefined) ?? null;
}

export function findUserById(db: Db, id: number): User | null {
	return (db.prepare('SELECT * FROM user WHERE id = ?').get(id) as User | undefined) ?? null;
}

export function listUsers(db: Db): User[] {
	return db.prepare('SELECT * FROM user ORDER BY created_at, id').all() as User[];
}

export function countUsers(db: Db): number {
	return db.prepare('SELECT COUNT(*) FROM user').pluck().get() as number;
}

export type CreateResult = { ok: true; user: User } | { ok: false; error: 'invalid' | 'taken'; message: string };

/** Buat akun. `passwordHash` sudah di-hash oleh pemanggil (hashing bersifat asinkron). */
export function createUser(
	db: Db,
	input: { login: string; passwordHash: string; mustChangePassword: boolean }
): CreateResult {
	const login = normalizeLogin(input.login);
	const invalid = validateLogin(login);
	if (invalid) return { ok: false, error: 'invalid', message: invalid };
	if (findUserByLogin(db, login)) return { ok: false, error: 'taken', message: 'Login sudah dipakai.' };
	try {
		const info = db
			.prepare('INSERT INTO user (login, password_hash, must_change_password) VALUES (?, ?, ?)')
			.run(login, input.passwordHash, input.mustChangePassword ? 1 : 0);
		return { ok: true, user: findUserById(db, Number(info.lastInsertRowid))! };
	} catch (err) {
		// Pengaman kedua bila ada dua permintaan bersamaan: batas UNIQUE di database.
		if (String((err as Error).message).includes('UNIQUE')) {
			return { ok: false, error: 'taken', message: 'Login sudah dipakai.' };
		}
		throw err;
	}
}

export function recordLogin(db: Db, userId: number, now: Date = new Date()): void {
	db.prepare('UPDATE user SET last_login_at = ? WHERE id = ?').run(now.toISOString(), userId);
}

/** Ganti hash password; `mustChange` mengatur penanda wajib ganti password. */
export function setPassword(db: Db, userId: number, passwordHash: string, mustChange: boolean): void {
	db.prepare(
		`UPDATE user SET password_hash = ?, must_change_password = ?,
		 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
	).run(passwordHash, mustChange ? 1 : 0, userId);
}

export type ActionResult = { ok: true } | { ok: false; error: 'self' | 'last' | 'notfound'; message: string };

/**
 * Reset password akun lain oleh admin: simpan hash baru, wajib ganti password, dan cabut
 * semua sesi akun target. Reset akun sendiri ditolak (pakai ganti password).
 */
export function resetPassword(db: Db, actorId: number, targetId: number, passwordHash: string): ActionResult {
	if (actorId === targetId) {
		return {
			ok: false,
			error: 'self',
			message: 'Untuk mengganti password sendiri, gunakan halaman Ganti password.'
		};
	}
	return db.transaction((): ActionResult => {
		if (!findUserById(db, targetId)) return { ok: false, error: 'notfound', message: 'Akun tidak ditemukan.' };
		setPassword(db, targetId, passwordHash, true);
		deleteUserSessions(db, targetId);
		return { ok: true };
	})();
}

/** Hapus akun lain. Menolak menghapus diri sendiri dan menolak meninggalkan nol akun. */
export function deleteUser(db: Db, actorId: number, targetId: number): ActionResult {
	if (actorId === targetId) {
		return { ok: false, error: 'self', message: 'Kamu tidak bisa menghapus akunmu sendiri.' };
	}
	return db.transaction((): ActionResult => {
		if (!findUserById(db, targetId)) return { ok: false, error: 'notfound', message: 'Akun tidak ditemukan.' };
		if (countUsers(db) <= 1) {
			return { ok: false, error: 'last', message: 'Akun terakhir tidak bisa dihapus.' };
		}
		db.prepare('DELETE FROM user WHERE id = ?').run(targetId); // sesi ikut terhapus (CASCADE)
		return { ok: true };
	})();
}
