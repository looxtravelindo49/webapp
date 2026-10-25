import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[katalog] Katalog paket dan halaman detail', () => {
	const card = (page: import('@playwright/test').Page, title: string) =>
		page.locator('#katalog article').filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });

	test('semua kartu tampil, filter menyembunyikan, reset mengembalikan', async ({ page }) => {
		await gotoReady(page, '/');
		const ids = await page.$$eval('main > section[id]', (s) => s.map((x) => x.id));
		expect(ids.indexOf('katalog')).toBeGreaterThanOrEqual(0);
		expect(ids.indexOf('katalog')).toBeLessThan(ids.indexOf('paket'));
		const katalog = page.locator('#katalog');
		await expect(katalog.getByRole('heading', { level: 2 })).toHaveText('Aktivitas Pilihan di Lembang');
		await expect(katalog.getByText('HANDPICKED EXPERIENCES')).toBeVisible();
		await expect(card(page, 'Offroad').getByRole('link', { name: 'Lihat Detail' })).toBeVisible();
		await expect(card(page, 'Team Building').getByRole('link', { name: 'Lihat Detail' })).toBeVisible();
		await expect(card(page, 'Rafting').getByRole('link', { name: 'Lihat Detail' })).toBeVisible();
		await expect(card(page, 'Paintball').getByRole('link', { name: 'Lihat Detail' })).toBeVisible();
		await expect(card(page, 'Fun Games').getByRole('link', { name: 'Lihat Detail' })).toBeVisible();
		await expect(card(page, 'Offroad')).toContainText('Rp250.000');
		await expect(card(page, 'Offroad')).toContainText('/pax*');
		await expect(card(page, 'Offroad')).toContainText('Min. 1 peserta');
		await expect(card(page, 'Rafting').locator('img')).toHaveAttribute('src', '/media/rafting.webp');
		await expect(katalog.getByText('Lembang').first()).toBeVisible();
		await expect(katalog.getByText('*Offroad dihitung per mobil (maks. 7 orang/mobil)')).toBeVisible();

		await katalog.getByRole('button', { name: 'Corporate' }).click();
		await expect(card(page, 'Team Building')).toBeVisible();
		await expect(card(page, 'Offroad')).toBeHidden();
		await katalog.getByRole('button', { name: 'Reset filter' }).click();
		await expect(card(page, 'Offroad')).toBeVisible();
		await expect(page).toHaveURL(/\/$/);
	});

	test('grid 4 kolom desktop, 3 tablet, 2 ponsel', async ({ page }) => {
		await gotoReady(page, '/');
		const columns = async (width: number) => {
			await page.setViewportSize({ width, height: 900 });
			return page.locator('#katalog-daftar').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
		};
		expect(await columns(1440)).toBe(4);
		expect(await columns(800)).toBe(3);
		expect(await columns(390)).toBe(2);
	});

	test('Lihat Detail membuka tab kegiatan di beranda, di bawah header', async ({ page }) => {
		await gotoReady(page, '/');
		const before = await page.evaluate(() => history.length);
		await card(page, 'Paintball').getByRole('link', { name: 'Lihat Detail' }).click();
		await expect(page).toHaveURL(/\/#kegiatan-paintball$/);
		expect(await page.evaluate(() => history.length)).toBe(before);
		const tab = page.locator('#paket').getByRole('tab', { name: 'Paintball', exact: true });
		await expect(tab).toHaveAttribute('aria-selected', 'true');
		await expect(page.locator('#paket [aria-roledescription="slide"]:not([inert])').getByRole('heading', { level: 3 })).toHaveText('Paintball');
		await expect
			.poll(() =>
				page.evaluate(() => {
					const header = document.querySelector('header')!.getBoundingClientRect();
					const section = document.getElementById('paket')!.getBoundingClientRect();
					return section.top - header.bottom;
				})
			)
			.toBeGreaterThanOrEqual(8);
		await card(page, 'Rafting').getByRole('link', { name: 'Lihat Detail' }).click();
		await expect(page).toHaveURL(/\/#kegiatan-rafting$/);
		await expect(page.locator('#paket').getByRole('tab', { name: 'Rafting', exact: true })).toHaveAttribute('aria-selected', 'true');
	});

	test('reduced motion menempatkan section tanpa menunggu animasi', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await gotoReady(page, '/');
		await card(page, 'Fun Games').getByRole('link', { name: 'Lihat Detail' }).click();
		const gap = await page.evaluate(() => {
			const header = document.querySelector('header')!.getBoundingClientRect();
			const section = document.getElementById('paket')!.getBoundingClientRect();
			return section.top - header.bottom;
		});
		expect(gap).toBeGreaterThanOrEqual(8);
		expect(gap).toBeLessThan(24);
		await expect(page.locator('#paket').getByRole('tab', { name: 'Fun Games', exact: true })).toHaveAttribute('aria-selected', 'true');
	});

	test('#kegiatan-offroad memilih tab pertama dan menggulir ke section', async ({ page }) => {
		await gotoReady(page, '/#kegiatan-offroad');
		await expect(page.locator('#paket').getByRole('tab', { name: 'Offroad', exact: true })).toHaveAttribute('aria-selected', 'true');
		await expect
			.poll(() =>
				page.evaluate(() => {
					const header = document.querySelector('header')!.getBoundingClientRect();
					const section = document.getElementById('paket')!.getBoundingClientRect();
					return section.top >= header.bottom - 1 && section.bottom > header.bottom;
				})
			)
			.toBe(true);
	});

	test('tanpa JavaScript, Lihat Detail mengarah ke hash kegiatan', async ({ browser, baseURL }) => {
		const context = await browser.newContext({
			javaScriptEnabled: false,
			baseURL,
			extraHTTPHeaders: { 'X-Forwarded-Proto': 'http' }
		});
		const page = await context.newPage();
		await page.goto('/');
		const link = page.locator('#katalog article').filter({ hasText: 'Rafting' }).getByRole('link', { name: 'Lihat Detail' });
		await expect(link).toHaveAttribute('href', '#kegiatan-rafting');
		await link.click();
		await expect(page).toHaveURL(/#kegiatan-rafting$/);
		await expect
			.poll(() =>
				page.evaluate(() => {
					const header = document.querySelector('header')!.getBoundingClientRect();
					const target = document.getElementById('kegiatan-rafting')!.getBoundingClientRect();
					const gap = target.top - header.bottom;
					return gap >= 4 && gap < 40;
				})
			)
			.toBe(true);
		await context.close();
	});

	test('detail paket tetap ada dan menambahkannya ke kalkulator', async ({ page }) => {
		await gotoReady(page, '/paket/offroad');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offroad');
		await expect(page.getByText('2-3 Jam')).toBeVisible();
		await expect(page.getByText('Rp 250.000 / orang')).toBeVisible();
		await expect(page.getByText('Min. 1 orang')).toBeVisible();
		await expect(page).toHaveTitle(/Offroad \| Lembang Adventure/);
		const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
		expect(canonical).toMatch(/\/paket\/offroad$/);

		await page.getByRole('link', { name: 'Tambah ke Trip' }).click();
		await expect(page).toHaveURL(/\/\?paket=offroad#konsultasi$/);
		await expect(page.getByRole('checkbox', { name: /Offroad/ })).toBeChecked();
		await expect(page.getByRole('checkbox', { name: /Rafting/ })).not.toBeChecked();
	});

	test('slug yang tidak ada mengembalikan 404', async ({ page }) => {
		const res = await page.goto('/paket/tidak-ada');
		expect(res?.status()).toBe(404);
	});
});
