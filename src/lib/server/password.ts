import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
/** Batas parameter dari string hash agar data rusak tidak bisa memicu pemakaian memori besar. */
const MAX_N = 2 ** 17;
const MAX_R = 16;
const MAX_P = 4;

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number) {
	return new Promise<Buffer>((resolve, reject) => {
		scrypt(password, salt, keylen, { N: n, r, p, maxmem: 256 * n * r + 1024 * 1024 }, (err, key) =>
			err ? reject(err) : resolve(key)
		);
	});
}

/** `scrypt$N$r$p$<garam base64>$<hash base64>`; garam acak per pemanggilan. */
export async function hashPassword(plain: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await derive(plain, salt, N, R, P, KEYLEN);
	return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Bandingkan secara waktu-konstan; mengembalikan false (tanpa melempar) untuk hash rusak. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
	try {
		const [tag, n, r, p, saltB64, hashB64] = stored.split('$');
		if (tag !== 'scrypt' || !saltB64 || !hashB64) return false;
		const params = [Number(n), Number(r), Number(p)];
		if (!params.every((v) => Number.isInteger(v) && v > 0)) return false;
		const [nn, rr, pp] = params;
		if (nn > MAX_N || (nn & (nn - 1)) !== 0 || rr > MAX_R || pp > MAX_P) return false;
		const salt = Buffer.from(saltB64, 'base64');
		const expected = Buffer.from(hashB64, 'base64');
		if (salt.length === 0 || expected.length === 0) return false;
		const actual = await derive(plain, salt, nn, rr, pp, expected.length);
		return actual.length === expected.length && timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

let dummy: Promise<string> | undefined;
/**
 * Verifikasi terhadap hash tiruan agar login dengan akun yang tidak ada memakan waktu
 * yang sama dengan password salah pada akun yang ada. Selalu mengembalikan false.
 */
export async function verifyDummy(plain: string): Promise<false> {
	dummy ??= hashPassword(randomBytes(12).toString('hex'));
	await verifyPassword(plain, await dummy);
	return false;
}

/** Pesan kesalahan untuk password baru, atau null bila lolos. */
export function validateNewPassword(
	password: string,
	opts: { login?: string; current?: string } = {}
): string | null {
	if (password.length < MIN_PASSWORD) return `Password minimal ${MIN_PASSWORD} karakter.`;
	if (password.length > MAX_PASSWORD) return `Password maksimal ${MAX_PASSWORD} karakter.`;
	if (opts.login && password.toLowerCase() === opts.login.trim().toLowerCase()) {
		return 'Password tidak boleh sama dengan login.';
	}
	if (opts.current !== undefined && password === opts.current) {
		return 'Password baru harus berbeda dari password lama.';
	}
	return null;
}
