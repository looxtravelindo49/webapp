import { all, one, run, scalar, transaction, type Db, type Queryable } from './db';
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

export function findUserByLogin(db: Queryable, login: string): Promise<User | null> {
	return one<User>(db, 'SELECT * FROM user WHERE login = ?', [normalizeLogin(login)]);
}

/** `id` yang bukan bilangan bulat (mis. NaN dari masukan rusak) berarti tidak ada; libSQL menolak NaN sebagai argumen. */
export async function findUserById(db: Queryable, id: number): Promise<User | null> {
	if (!Number.isInteger(id)) return null;
	return one<User>(db, 'SELECT * FROM user WHERE id = ?', [id]);
}

export function listUsers(db: Queryable): Promise<User[]> {
	return all<User>(db, 'SELECT * FROM user ORDER BY created_at, id');
}

export async function countUsers(db: Queryable): Promise<number> {
	return (await scalar<number>(db, 'SELECT COUNT(*) FROM user')) ?? 0;
}

export type CreateResult = { ok: true; user: User } | { ok: false; error: 'invalid' | 'taken'; message: string };

/** Buat akun. `passwordHash` sudah di-hash oleh pemanggil (hashing bersifat asinkron). */
export async function createUser(
	db: Queryable,
	input: { login: string; passwordHash: string; mustChangePassword: boolean }
): Promise<CreateResult> {
	const login = normalizeLogin(input.login);
	const invalid = validateLogin(login);
	if (invalid) return { ok: false, error: 'invalid', message: invalid };
	if (await findUserByLogin(db, login)) return { ok: false, error: 'taken', message: 'Login sudah dipakai.' };
	try {
		const info = await run(db, 'INSERT INTO user (login, password_hash, must_change_password) VALUES (?, ?, ?)', [
			login,
			input.passwordHash,
			input.mustChangePassword ? 1 : 0
		]);
		return { ok: true, user: (await findUserById(db, Number(info.lastInsertRowid)))! };
	} catch (err) {
		// Pengaman kedua bila ada dua permintaan bersamaan: batas UNIQUE di database.
		if (String((err as Error).message).includes('UNIQUE')) {
			return { ok: false, error: 'taken', message: 'Login sudah dipakai.' };
		}
		throw err;
	}
}

export async function recordLogin(db: Queryable, userId: number, now: Date = new Date()): Promise<void> {
	await run(db, 'UPDATE user SET last_login_at = ? WHERE id = ?', [now.toISOString(), userId]);
}

/** Ganti hash password; `mustChange` mengatur penanda wajib ganti password. */
export async function setPassword(db: Queryable, userId: number, passwordHash: string, mustChange: boolean): Promise<void> {
	await run(
		db,
		`UPDATE user SET password_hash = ?, must_change_password = ?,
		 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
		[passwordHash, mustChange ? 1 : 0, userId]
	);
}

export type ActionResult = { ok: true } | { ok: false; error: 'self' | 'last' | 'notfound'; message: string };

/**
 * Reset password akun lain oleh admin: simpan hash baru, wajib ganti password, dan cabut
 * semua sesi akun target. Reset akun sendiri ditolak (pakai ganti password).
 */
export async function resetPassword(db: Db, actorId: number, targetId: number, passwordHash: string): Promise<ActionResult> {
	if (actorId === targetId) {
		return {
			ok: false,
			error: 'self',
			message: 'Untuk mengganti password sendiri, gunakan halaman Ganti password.'
		};
	}
	return transaction(db, async (tx): Promise<ActionResult> => {
		if (!(await findUserById(tx, targetId))) return { ok: false, error: 'notfound', message: 'Akun tidak ditemukan.' };
		await setPassword(tx, targetId, passwordHash, true);
		await deleteUserSessions(tx, targetId);
		return { ok: true };
	});
}

/** Hapus akun lain. Menolak menghapus diri sendiri dan menolak meninggalkan nol akun. */
export async function deleteUser(db: Db, actorId: number, targetId: number): Promise<ActionResult> {
	if (actorId === targetId) {
		return { ok: false, error: 'self', message: 'Kamu tidak bisa menghapus akunmu sendiri.' };
	}
	return transaction(db, async (tx): Promise<ActionResult> => {
		if (!(await findUserById(tx, targetId))) return { ok: false, error: 'notfound', message: 'Akun tidak ditemukan.' };
		if ((await countUsers(tx)) <= 1) {
			return { ok: false, error: 'last', message: 'Akun terakhir tidak bisa dihapus.' };
		}
		await run(tx, 'DELETE FROM user WHERE id = ?', [targetId]); // sesi ikut terhapus (CASCADE)
		return { ok: true };
	});
}
