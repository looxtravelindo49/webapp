import type { Page } from '@playwright/test';
import { insertArticle, uniqueTitle } from '../support/articles';
import { expect, gotoReady, test } from '../support/fixtures';

// Tes publik hanya membaca tiga artikel bawaan; artikel draf buatan tes ini tidak memengaruhi halaman publik
// dan dibersihkan oleh e2e/mutating/articles.spec.ts (awalan "Tes Publik").
const SEEDED = [
	{ slug: 'sepakati-5-hal-sebelum-gathering-kantor', category: 'PERENCANAAN', h1: /Sepakati 5 hal/ },
	{ slug: 'offroad-atau-pantai-kenali-selera-timmu', category: 'PILIH KEGIATAN', h1: /Kenali selera timmu/ },
	{ slug: 'itinerary-enak-tidak-harus-padat-acara', category: 'TIPS PANITIA', h1: /Itinerary yang enak/ }
];
const top = (page: Page, selector: string) => page.locator(selector).evaluate((e) => e.getBoundingClientRect().top);
const navHeight = async (page: Page) => (await page.locator('header').first().boundingBox())!.height;

test.describe('[article-pages] Daftar artikel', () => {
	test('menampilkan artikel terbit, terbaru dulu, dengan satu h1 dan metadata', async ({ page }) => {
		await gotoReady(page, '/artikel');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel');
		const hrefs = await page.locator('main a[href^="/artikel/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
		expect(hrefs.slice(0, 3)).toEqual(SEEDED.map((a) => `/artikel/${a.slug}`));
		await expect(page).toHaveTitle(/Artikel/);
		await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /.{40,}/);
		await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /^http:\/\/127\.0\.0\.1:\d+\/artikel$/);
	});

	test('artikel draf tidak tampil di daftar', async ({ page }) => {
		const title = uniqueTitle('Tes Publik Draf');
		insertArticle(title);
		await gotoReady(page, '/artikel');
		await expect(page.getByText(title)).toHaveCount(0);
	});
});

test.describe('[article-pages] Halaman artikel', () => {
	for (const a of SEEDED) {
		test(`/artikel/${a.slug}: judul, kategori, tanggal, isi, dan metadata`, async ({ page }) => {
			await gotoReady(page, `/artikel/${a.slug}`);
			await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
			await expect(page.getByRole('heading', { level: 1 })).toContainText(a.h1);
			await expect(page.locator('article')).toContainText(a.category);
			await expect(page.locator('article time')).toHaveAttribute('datetime', /^2026-09-/);
			expect(await page.locator('.article-body p').count()).toBeGreaterThanOrEqual(2);
			await expect(page).toHaveTitle(/ \| Lembang Adventures$/);
			await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /.{40,}/);
			await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', new RegExp(`^http://127\\.0\\.0\\.1:\\d+/artikel/${a.slug}$`));
			await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
			await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
			await expect(page.locator('article img')).toHaveAttribute('alt', /.+/);
		});
	}

	test('slug tidak ada dan artikel draf menjawab 404', async ({ page, request }) => {
		const title = uniqueTitle('Tes Publik Draf404');
		const row = insertArticle(title);
		expect((await request.get(`/artikel/${row.slug}`)).status()).toBe(404);
		expect((await request.get('/artikel/tidak-ada-sama-sekali')).status()).toBe(404);
		await page.goto('/artikel/tidak-ada-sama-sekali');
		await expect(page.getByText('Artikel tidak ditemukan.')).toBeVisible();
	});

	test('tautan "Konsultasi Trip" di bawah artikel menuju beranda #konsultasi', async ({ page }) => {
		await gotoReady(page, `/artikel/${SEEDED[0].slug}`);
		await page.locator('article').getByRole('link', { name: /Konsultasi Trip/ }).click();
		await expect(page).toHaveURL(/\/#konsultasi$/);
		await expect.poll(() => top(page, '#konsultasi')).toBeGreaterThanOrEqual((await navHeight(page)) - 2);
		await expect.poll(() => top(page, '#konsultasi')).toBeLessThan(200);
	});
});

test.describe('[site-shell] Navigasi dari halaman selain beranda', () => {
	test('Navbar "Pilihan Paket" dan CTA, serta Footer, kembali ke beranda dan menggulir ke tujuan', async ({ page }) => {
		await gotoReady(page, '/artikel');
		await page.locator('header nav').getByRole('link', { name: 'Pilihan Paket' }).click();
		await expect(page).toHaveURL(/\/#paket$/);
		await expect.poll(() => top(page, '#paket')).toBeGreaterThanOrEqual((await navHeight(page)) - 2);
		await expect.poll(() => top(page, '#paket')).toBeLessThan(200);

		await gotoReady(page, `/artikel/${SEEDED[1].slug}`);
		await page.locator('header').getByRole('link', { name: 'Konsultasi Trip' }).and(page.locator(':visible')).click();
		await expect(page).toHaveURL(/\/#konsultasi$/);
		await expect.poll(() => top(page, '#konsultasi')).toBeLessThan(200);

		await gotoReady(page, '/artikel');
		await page.locator('footer').getByRole('link', { name: /Bikin cerita bareng timmu/ }).click();
		await expect(page).toHaveURL(/\/#rencanakan$/);
		await expect.poll(() => top(page, '#rencanakan')).toBeLessThan(320);
	});

	test('menu mobile di halaman artikel membuka dan menutup setelah memilih tautan', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });
		await gotoReady(page, '/artikel');
		const toggle = page.locator('header button[aria-controls]');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await page.locator('header nav').getByRole('link', { name: 'Rencanakan Trip' }).click();
		await expect(page).toHaveURL(/\/#rencanakan$/);
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});
});

test.describe('[article-pages] Responsif', () => {
	for (const url of ['/', '/artikel', `/artikel/${SEEDED[0].slug}`]) {
		test(`${url} tidak memiliki scroll horizontal pada 360px`, async ({ page }) => {
			await page.setViewportSize({ width: 360, height: 800 });
			await gotoReady(page, url);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		});
	}
});
