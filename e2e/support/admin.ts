import { randomBytes, scryptSync } from 'node:crypto';
import { exec, scalar } from './db';

// HARUS selaras dengan src/lib/server/password.ts (N=16384, r=8, p=1, garam 16 byte, kunci 64 byte).
// Bila formatnya menyimpang, login lewat UI akan gagal sehingga tes yang memakai helper ini ikut gagal.
function hash(password: string): string {
	const N = 16384, r = 8, p = 1;
	const salt = randomBytes(16);
	const key = scryptSync(password, salt, 64, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 });
	return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Login unik (huruf kecil, a-z 0-9 -) agar tes tidak saling mengganggu dan tidak terkena pembatas login. */
export function uniqueLogin(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toLowerCase().slice(0, 60);
}

/** Tulis akun langsung ke database (tanpa lewat UI). */
export function insertAdmin(login: string, password: string, opts: { mustChange?: boolean } = {}): number {
	exec('INSERT INTO user (login, password_hash, must_change_password) VALUES (?, ?, ?)', login, hash(password), opts.mustChange ? 1 : 0);
	return scalar<number>('SELECT id FROM user WHERE login = ?', login);
}

export const userRow = (login: string) =>
	scalar<number | undefined>('SELECT id FROM user WHERE login = ?', login);
