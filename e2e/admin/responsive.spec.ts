import type { Page } from '@playwright/test';
import { adminLogin, path } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { expect, gotoReady, test } from '../support/fixtures';

const PW = 'sandi-uji-resp-1';
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test.describe('[admin-auth] Responsif area admin', () => {
	for (const width of [360, 768, 1280]) {
		test(`halaman login tanpa scroll horizontal pada ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await gotoReady(page, '/admin/login');
			expect(await noHorizontalScroll(page)).toBe(true);
		});
	}
});

test.describe('[admin-accounts] Responsif halaman admin setelah login', () => {
	for (const width of [360, 768, 1280]) {
		test(`beranda, ganti password, kelola akun, paket, form paket, dan pengaturan tanpa scroll horizontal pada ${width}px`, async ({ page }) => {
			const login = uniqueLogin('resp');
			insertAdmin(login, PW);
			insertAdmin(uniqueLogin('panjang-sekali-nama-login-untuk-menguji-pembungkusan'), PW);
			await page.setViewportSize({ width, height: 800 });
			await adminLogin(page, login, PW);
			for (const url of ['/admin', '/admin/akun', '/admin/ganti-password', '/admin/paket', '/admin/paket/baru', '/admin/pengaturan']) {
				await gotoReady(page, url);
				expect(path(page), url).toBe(url);
				expect(await noHorizontalScroll(page), `${url} @${width}px`).toBe(true);
			}
		});
	}
});
