import { adminLogin, alerts, noClientValidation, path } from '../support/admin-ui';
import { scalar } from '../support/db';
import { DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD } from '../support/env';
import { expect, gotoReady, openContext, openPage, submit, test } from '../support/fixtures';

// Akun awal bawaan hanya bisa melewati "login pertama" sekali; karena itu file ini serial dan memilikinya.
test.describe.configure({ mode: 'serial' });

const mustChange = () => scalar<number | undefined>('SELECT must_change_password FROM user WHERE login = ?', DEFAULT_ADMIN_LOGIN);

test.beforeAll(() => {
	test.skip(mustChange() !== 1, 'Akun awal bawaan sudah pernah diganti (server dipakai ulang); jalankan dengan database baru.');
});

async function changePassword(page: import('@playwright/test').Page, current: string, next: string, confirm: string) {
	await gotoReady(page, '/admin/ganti-password');
	await noClientValidation(page);
	await page.getByLabel('Password lama').fill(current);
	await page.getByLabel('Password baru', { exact: true }).fill(next);
	await page.getByLabel('Ulangi password baru').fill(confirm);
	await submit(page, () => page.getByRole('button', { name: 'Simpan password baru' }).click());
}

test.describe('[admin-auth] Login pertama akun awal dan wajib ganti password', () => {
	test('login (huruf besar + spasi) diarahkan ke ganti password; cookie dan penanda benar', async ({ page, context }) => {
		await adminLogin(page, ` ${DEFAULT_ADMIN_LOGIN.toUpperCase()} `, DEFAULT_ADMIN_PASSWORD);
		expect(path(page)).toBe('/admin/ganti-password');

		const cookie = (await context.cookies()).find((c) => c.name === 'session');
		expect(cookie, 'cookie session terpasang').toBeTruthy();
		expect(cookie!.httpOnly).toBe(true);
		expect(cookie!.sameSite).toBe('Lax');
		expect(cookie!.path).toBe('/');
		const days = (cookie!.expires - Date.now() / 1000) / 86400;
		expect(days).toBeGreaterThan(6.99);
		expect(days).toBeLessThanOrEqual(7.01);
		expect(cookie!.value.length).toBeGreaterThanOrEqual(40);
		expect(scalar<number>('SELECT COUNT(*) FROM session WHERE id = ?', cookie!.value), 'token tidak disimpan mentah').toBe(0);

		expect(mustChange()).toBe(1);
		expect(scalar<number>('SELECT last_login_at IS NOT NULL FROM user WHERE login = ?', DEFAULT_ADMIN_LOGIN)).toBe(1);
	});

	test('/admin dan /admin/akun dialihkan selagi wajib ganti; navigasi admin disembunyikan; Keluar tersedia', async ({ page }) => {
		await adminLogin(page, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD);
		for (const url of ['/admin', '/admin/akun']) {
			await gotoReady(page, url);
			expect(path(page), url).toBe('/admin/ganti-password');
		}
		await expect(page.getByRole('navigation', { name: 'Navigasi admin' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible();
		await expect(page.getByText('Pilihan Paket')).toHaveCount(0);
		await expect(page.getByText(/Akunmu masih memakai password sementara/)).toBeVisible();
	});
});

test.describe('[admin-auth] Ganti password sendiri', () => {
	test('lima validasi ditolak tanpa mengubah apa pun', async ({ page }) => {
		await adminLogin(page, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD);
		const cases: [string, string, string, string, string][] = [
			['password lama salah', 'salah-lama', 'kata-sandi-baru', 'kata-sandi-baru', 'Password lama salah.'],
			['password baru 7 karakter', DEFAULT_ADMIN_PASSWORD, '1234567', '1234567', 'Password minimal 8 karakter.'],
			['sama dengan password lama', DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD, 'Password baru harus berbeda dari password lama.'],
			['sama dengan login', DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_LOGIN, 'Password tidak boleh sama dengan login.'],
			['konfirmasi berbeda', DEFAULT_ADMIN_PASSWORD, 'kata-sandi-baru', 'beda-konfirmasi', 'Konfirmasi password tidak sama.']
		];
		for (const [label, cur, next, conf, message] of cases) {
			await changePassword(page, cur, next, conf);
			expect(await alerts(page), label).toEqual([message]);
			expect(path(page), label).toBe('/admin/ganti-password');
		}
		expect(mustChange()).toBe(1);
	});

	test('isian password baru memakai minlength 8 di sisi klien', async ({ page }) => {
		await adminLogin(page, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD);
		await gotoReady(page, '/admin/ganti-password');
		await expect(page.getByLabel('Password baru', { exact: true })).toHaveAttribute('minlength', '8');
	});

	test('berhasil: ke /admin, penanda wajib dihapus, sesi lain dibatalkan, sesi saat ini tetap', async ({ page, browser, baseURL, extraHTTPHeaders }) => {
		const other = await openContext(browser, baseURL, extraHTTPHeaders);
		const second = await openPage(other);
		await adminLogin(second.page, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD);
		expect(path(second.page)).toBe('/admin/ganti-password');

		await adminLogin(page, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD);
		await changePassword(page, DEFAULT_ADMIN_PASSWORD, 'kata-sandi-baru', 'kata-sandi-baru');
		expect(path(page)).toBe('/admin');
		expect(mustChange()).toBe(0);
		await expect(page.getByRole('navigation', { name: 'Navigasi admin' })).toBeVisible();

		await gotoReady(second.page, '/admin');
		expect(path(second.page), 'sesi lain tidak lagi berlaku').toBe('/admin/login');
		expect(scalar<number>('SELECT COUNT(*) FROM session WHERE user_id = (SELECT id FROM user WHERE login = ?)', DEFAULT_ADMIN_LOGIN)).toBe(1);
		await other.close();
		expect(second.errors()).toEqual([]);
	});

	test('setelah diganti: password lama gagal, password baru berhasil langsung ke /admin', async ({ page }) => {
		await adminLogin(page, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD);
		expect(path(page)).toBe('/admin/login');
		expect(await alerts(page)).toEqual(['Login atau password salah.']);
		await adminLogin(page, DEFAULT_ADMIN_LOGIN, 'kata-sandi-baru');
		expect(path(page)).toBe('/admin');
	});
});
