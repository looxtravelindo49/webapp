import { describe, expect, it } from 'vitest';
import { hashPassword, validateNewPassword, verifyDummy, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
	it('berformat scrypt$N$r$p$garam$hash', async () => {
		const h = await hashPassword('rahasia-123');
		const parts = h.split('$');
		expect(parts).toHaveLength(6);
		expect(parts.slice(0, 4)).toEqual(['scrypt', '16384', '8', '1']);
		expect(Buffer.from(parts[4], 'base64')).toHaveLength(16);
		expect(Buffer.from(parts[5], 'base64')).toHaveLength(64);
		expect(h).not.toContain('rahasia-123');
	});

	it('password sama menghasilkan hash berbeda (garam acak) yang keduanya lolos verifikasi', async () => {
		const [a, b] = await Promise.all([hashPassword('sama-sama-1'), hashPassword('sama-sama-1')]);
		expect(a).not.toBe(b);
		expect(await verifyPassword('sama-sama-1', a)).toBe(true);
		expect(await verifyPassword('sama-sama-1', b)).toBe(true);
	});

	it('password salah ditolak', async () => {
		const h = await hashPassword('benar-benar-1');
		expect(await verifyPassword('salah-salah-1', h)).toBe(false);
		expect(await verifyPassword('', h)).toBe(false);
		expect(await verifyPassword('Benar-benar-1', h)).toBe(false);
	});

	it.each([
		'',
		'bukan-hash',
		'scrypt$16384$8$1$',
		'scrypt$x$8$1$AAAA$AAAA',
		'scrypt$16384$8$1$$',
		'bcrypt$16384$8$1$AAAA$AAAA',
		'scrypt$16384$8$1$AAAA',
		'scrypt$1000$8$1$AAAA$AAAA', // N bukan pangkat dua
		'scrypt$4294967296$8$1$AAAA$AAAA', // N di atas batas
		'scrypt$16384$8$99$AAAA$AAAA' // p di atas batas
	])('hash rusak %j mengembalikan false tanpa melempar', async (stored) => {
		await expect(verifyPassword('apa-saja-123', stored)).resolves.toBe(false);
	});

	it('mendukung password panjang dan karakter Unicode', async () => {
		const pw = 'pässwörd-🔒-' + 'x'.repeat(100);
		const h = await hashPassword(pw);
		expect(await verifyPassword(pw, h)).toBe(true);
		expect(await verifyPassword(pw + 'y', h)).toBe(false);
	});

	it('verifyDummy selalu false', async () => {
		expect(await verifyDummy('apa-saja')).toBe(false);
	});
});

describe('validateNewPassword', () => {
	it('menolak kurang dari 8 dan lebih dari 128 karakter', () => {
		expect(validateNewPassword('1234567')).toBe('Password minimal 8 karakter.');
		expect(validateNewPassword('x'.repeat(129))).toBe('Password maksimal 128 karakter.');
	});
	it('menerima batas 8 dan 128', () => {
		expect(validateNewPassword('12345678')).toBeNull();
		expect(validateNewPassword('x'.repeat(128))).toBeNull();
	});
	it('menolak sama dengan login (tanpa memandang huruf besar-kecil)', () => {
		expect(validateNewPassword('Admin@Looxtravel', { login: 'admin@looxtravel' })).toBe('Password tidak boleh sama dengan login.');
	});
	it('menolak sama dengan password lama', () => {
		expect(validateNewPassword('password-lama-1', { current: 'password-lama-1' })).toBe(
			'Password baru harus berbeda dari password lama.'
		);
		expect(validateNewPassword('password-baru-1', { current: 'password-lama-1' })).toBeNull();
	});
});
