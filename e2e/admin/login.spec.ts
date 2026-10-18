import { adminLogin, alerts, path } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { exec, scalar } from '../support/db';
import { expect, gotoReady, submit, test } from '../support/fixtures';

const PW = 'sandi-uji-login-1';

test.describe('[admin-auth] Login', () => {
	test('galat generik: pesan identik untuk password salah dan akun tidak ada; tanpa cookie; password tidak dikembalikan', async ({ page, context }) => {
		const login = uniqueLogin('lg');
		insertAdmin(login, PW);
		const messages: string[] = [];
		for (const [l, pw] of [[login, 'salah-banget-1'], [uniqueLogin('hantu'), 'salah-banget-1']]) {
			await adminLogin(page, l, pw);
			messages.push((await alerts(page))[0]);
			expect(path(page)).toBe('/admin/login');
			await expect(page.getByLabel('Login')).toHaveValue(l);
			await expect(page.getByLabel('Password')).toHaveValue('');
		}
		expect(messages).toEqual(['Login atau password salah.', 'Login atau password salah.']);
		expect((await context.cookies()).filter((c) => c.name === 'session')).toHaveLength(0);
		expect(await page.content()).not.toContain('salah-banget-1');
	});

	test('login dipangkas dan tidak peka huruf besar-kecil', async ({ page }) => {
		const login = uniqueLogin('mixed');
		insertAdmin(login, PW);
		await adminLogin(page, `  ${login.toUpperCase()}  `, PW);
		expect(path(page)).toBe('/admin');
		await expect(page.getByText(login)).toBeVisible();
	});

	test('sudah login membuka /admin/login → dialihkan ke /admin', async ({ page }) => {
		const login = uniqueLogin('again');
		insertAdmin(login, PW);
		await adminLogin(page, login, PW);
		await gotoReady(page, '/admin/login');
		expect(path(page)).toBe('/admin');
	});

	test('form login berlabel dan urutan fokus login → password → Masuk', async ({ page }) => {
		await gotoReady(page, '/admin/login');
		await page.keyboard.press('Tab');
		await expect(page.getByLabel('Login')).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(page.getByLabel('Password')).toBeFocused();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Masuk' })).toBeFocused();
		const outline = await page.evaluate(() => {
			const s = getComputedStyle(document.activeElement!);
			return `${s.outlineStyle} ${s.outlineWidth}`;
		});
		expect(outline).toMatch(/solid 3px/);
	});
});

test.describe('[admin-auth] Sesi dan keluar', () => {
	test('Keluar menghapus sesi dan cookie; /admin kembali dialihkan ke login', async ({ page, context }) => {
		const login = uniqueLogin('out');
		const id = insertAdmin(login, PW);
		await adminLogin(page, login, PW);
		expect(scalar<number>('SELECT COUNT(*) FROM session WHERE user_id = ?', id)).toBe(1);
		await submit(page, () => page.getByRole('button', { name: 'Keluar' }).click());
		expect(path(page)).toBe('/admin/login');
		expect((await context.cookies()).filter((c) => c.name === 'session')).toHaveLength(0);
		expect(scalar<number>('SELECT COUNT(*) FROM session WHERE user_id = ?', id)).toBe(0);
		await gotoReady(page, '/admin');
		expect(path(page)).toBe('/admin/login');
	});

	test('keluar hanya lewat POST: GET /admin/logout ditolak (405)', async ({ page }) => {
		const login = uniqueLogin('get');
		insertAdmin(login, PW);
		await adminLogin(page, login, PW);
		const res = await page.request.get('/admin/logout', { maxRedirects: 0 });
		expect(res.status()).toBe(405);
		await gotoReady(page, '/admin');
		expect(path(page), 'sesi tetap berlaku').toBe('/admin');
	});

	test('sesi kedaluwarsa dialihkan ke login dan barisnya dihapus', async ({ page }) => {
		const login = uniqueLogin('exp');
		const id = insertAdmin(login, PW);
		await adminLogin(page, login, PW);
		exec("UPDATE session SET expires_at = '2000-01-01T00:00:00.000Z' WHERE user_id = ?", id);
		await gotoReady(page, '/admin');
		expect(path(page)).toBe('/admin/login');
		expect(scalar<number>('SELECT COUNT(*) FROM session WHERE user_id = ?', id)).toBe(0);
	});

	test('cookie dengan token acak dianggap belum login', async ({ page, context, baseURL }) => {
		await context.addCookies([{ name: 'session', value: 'token-acak-yang-tidak-ada-di-database', url: baseURL! }]);
		await gotoReady(page, '/admin');
		expect(path(page)).toBe('/admin/login');
	});

	test('akun wajib ganti password tetap bisa keluar', async ({ page, context }) => {
		const login = uniqueLogin('must');
		insertAdmin(login, PW, { mustChange: true });
		await adminLogin(page, login, PW);
		expect(path(page)).toBe('/admin/ganti-password');
		await submit(page, () => page.getByRole('button', { name: 'Keluar' }).click());
		expect(path(page)).toBe('/admin/login');
		expect((await context.cookies()).filter((c) => c.name === 'session')).toHaveLength(0);
	});

	test('masuk lagi dengan akun yang wajib ganti diarahkan ke ganti password, bukan /admin', async ({ page }) => {
		const login = uniqueLogin('must2');
		insertAdmin(login, PW, { mustChange: true });
		await adminLogin(page, login, PW);
		expect(path(page)).toBe('/admin/ganti-password');
		await gotoReady(page, '/admin/login');
		expect(path(page)).toBe('/admin/ganti-password');
	});
});
