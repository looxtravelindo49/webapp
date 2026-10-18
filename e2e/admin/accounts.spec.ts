import type { Page } from '@playwright/test';
import { adminLogin, alerts, noClientValidation, path } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { scalar } from '../support/db';
import { expect, gotoReady, openContext, openPage, submit, test } from '../support/fixtures';

// Satu admin dibuat sekali dan dipakai bergantian oleh tes-tes serial di file ini.
test.describe.configure({ mode: 'serial' });

const PW = 'sandi-admin-akun-1';
let admin = '';
let adminId = 0;

test.beforeAll(() => {
	admin = uniqueLogin('akun');
	adminId = insertAdmin(admin, PW);
});

const row = (page: Page, login: string) => page.getByRole('listitem').filter({ hasText: login }).first();
const userId = (login: string) => scalar<number | undefined>('SELECT id FROM user WHERE login = ?', login);

async function create(page: Page, login: string, password: string) {
	await gotoReady(page, '/admin/akun');
	await noClientValidation(page);
	const form = page.locator('section[aria-labelledby=baru]');
	await form.getByLabel('Login').fill(login);
	await form.getByLabel('Password sementara').fill(password);
	await submit(page, () => form.getByRole('button', { name: 'Buat akun' }).click());
}

test.describe('[admin-accounts] Daftar akun', () => {
	test('menampilkan penanda "Anda" dan status; akun sendiri tanpa tombol hapus/reset', async ({ page }) => {
		const other = uniqueLogin('lain');
		insertAdmin(other, 'sandi-lain-1', { mustChange: true });
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/akun');
		await expect(row(page, admin)).toContainText('Anda');
		await expect(row(page, admin).getByRole('button', { name: 'Hapus' })).toHaveCount(0);
		await expect(row(page, admin).getByText('Reset password')).toHaveCount(0);
		await expect(row(page, admin).getByRole('link', { name: 'Ganti password' })).toBeVisible();
		await expect(row(page, other)).toContainText('Wajib ganti password');
		await expect(row(page, other)).not.toContainText('Anda');
		await expect(row(page, other).getByRole('button', { name: 'Hapus' })).toBeVisible();
	});
});

test.describe('[admin-accounts] Buat akun', () => {
	test('berhasil: login dinormalisasi ke huruf kecil, status wajib ganti, notifikasi tanpa menampilkan password', async ({ page }) => {
		const login = uniqueLogin('Budi.Baru');
		await adminLogin(page, admin, PW);
		await create(page, login.replace('budi.baru', 'Budi.Baru'), 'sementara-123');
		const normalized = login.toLowerCase();
		await expect(page.getByRole('status').first()).toContainText(normalized);
		await expect(row(page, normalized)).toContainText('Wajib ganti password');
		expect(userId(normalized)).toBeTruthy();
		expect(scalar<number>('SELECT must_change_password FROM user WHERE login = ?', normalized)).toBe(1);
		expect(await page.content()).not.toContain('sementara-123');
	});

	test('akun baru login → wajib ganti password', async ({ page, browser, baseURL, extraHTTPHeaders }) => {
		const login = uniqueLogin('baru');
		await adminLogin(page, admin, PW);
		await create(page, login, 'sementara-123');
		const ctx = await openContext(browser, baseURL, extraHTTPHeaders);
		const fresh = await openPage(ctx);
		await adminLogin(fresh.page, login, 'sementara-123');
		expect(path(fresh.page)).toBe('/admin/ganti-password');
		await ctx.close();
		expect(fresh.errors()).toEqual([]);
	});

	test('login ganda (beda huruf besar) ditolak; isian login dipertahankan, password dikosongkan; pesan terhubung', async ({ page }) => {
		const login = uniqueLogin('ganda');
		insertAdmin(login, 'sandi-ganda-1');
		await adminLogin(page, admin, PW);
		await create(page, login.toUpperCase(), 'sementara-123');
		const form = page.locator('section[aria-labelledby=baru]');
		expect(await alerts(page)).toEqual(['Login sudah dipakai.']);
		await expect(form.getByLabel('Login')).toHaveValue(login.toUpperCase());
		await expect(form.getByLabel('Password sementara')).toHaveValue('');
		await expect(form.getByLabel('Login')).toHaveAttribute('aria-invalid', 'true');
		const ids = (await form.getByLabel('Login').getAttribute('aria-describedby'))!.split(' ');
		const roles = await Promise.all(ids.map((i) => page.locator(`#${i}`).getAttribute('role')));
		expect(roles).toContain('alert');
	});

	for (const [label, login] of [['berisi spasi', 'a b'], ['karakter terlarang', 'x!yz'], ['dua karakter', 'ab'], ['65 karakter', 'x'.repeat(65)]] as const) {
		test(`login ${label} ditolak dan tidak membuat akun`, async ({ page }) => {
			await adminLogin(page, admin, PW);
			await gotoReady(page, '/admin/akun');
			// maxlength di input memotong masukan; dilepas agar validasi di server yang diuji
			await page.evaluate(() => document.querySelectorAll('input[maxlength]').forEach((i) => i.removeAttribute('maxlength')));
			await noClientValidation(page);
			const form = page.locator('section[aria-labelledby=baru]');
			await form.getByLabel('Login').fill(login);
			await form.getByLabel('Password sementara').fill('sementara-123');
			await submit(page, () => form.getByRole('button', { name: 'Buat akun' }).click());
			expect((await alerts(page))[0]).toMatch(/^Login 3 sampai 64/);
			expect(userId(login)).toBeUndefined();
		});
	}

	test('password sementara 7 karakter ditolak', async ({ page }) => {
		const login = uniqueLogin('pendek');
		await adminLogin(page, admin, PW);
		await create(page, login, '1234567');
		expect(await alerts(page)).toEqual(['Password minimal 8 karakter.']);
		expect(userId(login)).toBeUndefined();
	});

	test('formulir berlabel dan pengelompokan akses: judul bagian dan label terhubung', async ({ page }) => {
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/akun');
		const form = page.locator('section[aria-labelledby=baru]');
		await expect(form.getByLabel('Login')).toBeVisible();
		await expect(form.getByLabel('Password sementara')).toHaveAttribute('minlength', '8');
		await expect(page.getByRole('heading', { name: 'Buat akun baru' })).toBeVisible();
	});
});

test.describe('[admin-accounts] Reset password akun lain', () => {
	test('berhasil: sesi target dicabut, password lama gagal, password baru berhasil lalu wajib ganti', async ({ page, browser, baseURL, extraHTTPHeaders }) => {
		const target = uniqueLogin('reset');
		insertAdmin(target, 'target-pw-lama-1');
		const ctx = await openContext(browser, baseURL, extraHTTPHeaders);
		const victim = await openPage(ctx);
		await adminLogin(victim.page, target, 'target-pw-lama-1');
		expect(path(victim.page)).toBe('/admin');

		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/akun');
		await row(page, target).locator('summary').click();
		await row(page, target).getByLabel('Password sementara baru').fill('reset-sementara-1');
		await submit(page, () => row(page, target).getByRole('button', { name: 'Reset password' }).click());
		await expect(page.getByRole('status').first()).toContainText('diatur ulang');
		expect(scalar<number>('SELECT must_change_password FROM user WHERE login = ?', target)).toBe(1);

		await gotoReady(victim.page, '/admin/ganti-password');
		expect(path(victim.page), 'sesi target dicabut').toBe('/admin/login');
		await adminLogin(victim.page, target, 'target-pw-lama-1');
		expect(path(victim.page)).toBe('/admin/login');
		expect(await alerts(victim.page)).toEqual(['Login atau password salah.']);
		await adminLogin(victim.page, target, 'reset-sementara-1');
		expect(path(victim.page)).toBe('/admin/ganti-password');
		await ctx.close();
		expect(victim.errors()).toEqual([]);
	});

	test('password sementara 7 karakter ditolak dan tidak mengubah apa pun', async ({ page }) => {
		const target = uniqueLogin('resetpendek');
		insertAdmin(target, 'target-pw-lama-1');
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/akun');
		await noClientValidation(page);
		await row(page, target).locator('summary').click();
		await row(page, target).getByLabel('Password sementara baru').fill('1234567');
		await submit(page, () => row(page, target).getByRole('button', { name: 'Reset password' }).click());
		// Pesan harus TERLIHAT (bagian reset dibuka lagi), bukan tersembunyi di dalam <details> yang tertutup.
		await expect(row(page, target).getByRole('alert')).toBeVisible();
		await expect(row(page, target).getByRole('alert')).toHaveText('Password minimal 8 karakter.');
		expect(scalar<number>('SELECT must_change_password FROM user WHERE login = ?', target)).toBe(0);
	});

	test('reset akun sendiri (permintaan langsung) ditolak', async ({ page, baseURL }) => {
		await adminLogin(page, admin, PW);
		const res = await page.request.post('/admin/akun?/reset', {
			form: { id: String(adminId), password: 'coba-reset-diri-1' },
			headers: { origin: new URL(baseURL!).origin }
		});
		expect(await res.text()).toContain('gunakan halaman Ganti password');
		await gotoReady(page, '/admin');
		expect(path(page), 'sesi dan password tidak berubah').toBe('/admin');
	});
});

test.describe('[admin-accounts] Hapus akun', () => {
	test('konfirmasi dibatalkan: tidak ada permintaan hapus dan akun tetap', async ({ page }) => {
		const target = uniqueLogin('batal');
		insertAdmin(target, 'target-pw-1');
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/akun');
		let deletes = 0;
		page.on('request', (r) => r.method() === 'POST' && r.url().includes('hapus') && deletes++);
		// Penangan dipasang SEBELUM klik: confirm() memblokir halaman sampai dialog ditangani.
		const messages: string[] = [];
		page.once('dialog', (d) => { messages.push(d.message()); void d.dismiss(); });
		await row(page, target).getByRole('button', { name: 'Hapus' }).click();
		await expect.poll(() => messages.length).toBe(1);
		expect(messages[0]).toContain(target);
		await page.evaluate(() => 0); // putaran balik ke halaman: pengiriman form (bila ada) sudah terjadi
		expect(deletes).toBe(0);
		expect(userId(target)).toBeTruthy();
		await expect(row(page, target)).toBeVisible();
	});

	test('dikonfirmasi: akun hilang dari daftar dan database, sesinya tidak berlaku', async ({ page, browser, baseURL, extraHTTPHeaders }) => {
		const target = uniqueLogin('hapus');
		insertAdmin(target, 'target-pw-1');
		const ctx = await openContext(browser, baseURL, extraHTTPHeaders);
		const victim = await openPage(ctx);
		await adminLogin(victim.page, target, 'target-pw-1');

		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/akun');
		page.once('dialog', (d) => d.accept());
		await submit(page, () => row(page, target).getByRole('button', { name: 'Hapus' }).click());
		await expect(page.getByRole('status').first()).toContainText('dihapus');
		await expect(page.getByRole('listitem').filter({ hasText: target })).toHaveCount(0);
		expect(userId(target)).toBeUndefined();
		expect(scalar<number>('SELECT COUNT(*) FROM session WHERE user_id NOT IN (SELECT id FROM user)')).toBe(0);

		await gotoReady(victim.page, '/admin');
		expect(path(victim.page)).toBe('/admin/login');
		await ctx.close();
		expect(victim.errors()).toEqual([]);
	});

	test('hapus tanpa tanda konfirmasi ditolak di server dan akun tetap', async ({ page, baseURL }) => {
		const target = uniqueLogin('tanpa');
		const id = insertAdmin(target, 'target-pw-1');
		await adminLogin(page, admin, PW);
		const res = await page.request.post('/admin/akun?/hapus', { form: { id: String(id) }, headers: { origin: new URL(baseURL!).origin } });
		expect(await res.text()).toContain('Penghapusan perlu konfirmasi');
		expect(userId(target)).toBe(id);
	});

	test('klik Hapus sebelum hidrasi tidak menghapus (server menuntut konfirmasi)', async ({ page }) => {
		const target = uniqueLogin('prehydrate');
		insertAdmin(target, 'target-pw-1');
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/akun');
		// Simulasikan tombol yang diklik sebelum JS terpasang: kirim formulir tanpa memicu handler onsubmit.
		await page.evaluate((t) => {
			const li = [...document.querySelectorAll('li')].find((e) => e.textContent?.includes(t))!;
			const form = li.querySelector('form[action="?/hapus"]') as HTMLFormElement;
			HTMLFormElement.prototype.submit.call(form); // submit() melewati event handler
		}, target);
		await expect(page.getByRole('alert').first()).toContainText('Penghapusan perlu konfirmasi');
		expect(userId(target)).toBeTruthy();
	});

	test('hapus akun sendiri (permintaan langsung dengan konfirmasi) ditolak', async ({ page, baseURL }) => {
		await adminLogin(page, admin, PW);
		const res = await page.request.post('/admin/akun?/hapus', {
			form: { id: String(adminId), confirm: 'yes' },
			headers: { origin: new URL(baseURL!).origin }
		});
		expect(await res.text()).toContain('tidak bisa menghapus akunmu sendiri');
		expect(userId(admin)).toBe(adminId);
	});
});
