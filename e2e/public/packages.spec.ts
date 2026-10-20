import type { Page } from '@playwright/test';
import { expect, gotoReady, test } from '../support/fixtures';

const NAMES = ['Offroad', 'Team Building', 'Rafting', 'Paintball', 'Fun Games'];
const carousel = (page: Page) => page.getByRole('region', { name: 'Paket kegiatan' });
const dot = (page: Page, name: string) => page.locator('#paket').getByRole('button', { name: `Geser ke ${name}`, exact: true });
const activeSlide = (page: Page) => page.locator('#paket [aria-roledescription="slide"]:not([inert])');
const label = (page: Page) => page.locator('#paket [aria-live="polite"]');

test.describe('[package-catalog] Paket tampil sebagai slider', () => {
	test('lima slide berurutan, slide pertama aktif, hanya satu yang bisa dioperasikan', async ({ page }) => {
		await gotoReady(page, '/');
		const labels = (await page.locator('#paket h3').allInnerTexts()).map((t) => t.trim());
		expect(labels).toEqual(NAMES);
		await expect(activeSlide(page)).toHaveCount(1);
		await expect(activeSlide(page).getByRole('heading', { level: 3 })).toHaveText('Offroad');
		await expect(label(page)).toHaveText('1/5 · Offroad');
		await expect(dot(page, 'Offroad')).toHaveAttribute('aria-current', 'true');
	});

	test('titik dan panah menampilkan slide yang diminta', async ({ page }) => {
		await gotoReady(page, '/');
		await dot(page, 'Rafting').click();
		await expect(activeSlide(page).getByRole('heading', { level: 3 })).toHaveText('Rafting');
		await expect(label(page)).toHaveText('3/5 · Rafting');
		await expect(dot(page, 'Rafting')).toHaveAttribute('aria-current', 'true');
		await expect(dot(page, 'Offroad')).not.toHaveAttribute('aria-current', 'true');

		await page.getByRole('button', { name: 'Paket berikutnya' }).click();
		await expect(label(page)).toHaveText('4/5 · Paintball');
		await page.getByRole('button', { name: 'Paket sebelumnya' }).click();
		await expect(label(page)).toHaveText('3/5 · Rafting');
	});

	test('carousel bisa difokuskan; titik bukan tab', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(carousel(page)).toHaveAttribute('tabindex', '0');
		await expect(page.locator('#paket').getByRole('tablist')).toHaveCount(0);
		await expect(page.locator('#paket').getByRole('tab')).toHaveCount(0);
	});

	test('ARIA: carousel dan slide berlabel', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(carousel(page)).toHaveAttribute('aria-roledescription', 'carousel');
		await expect(page.locator('#paket [aria-roledescription="slide"]')).toHaveCount(5);
		await expect(activeSlide(page)).toHaveAttribute('aria-label', '1 dari 5: Offroad');
		await expect(page.getByRole('button', { name: 'Paket sebelumnya' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Paket berikutnya' })).toBeVisible();
	});
});

test.describe('[package-catalog] Navigasi keyboard slider', () => {
	test('panah kanan/kiri berputar, Home dan End melompat, fokus tetap di carousel', async ({ page }) => {
		await gotoReady(page, '/');
		await carousel(page).focus();
		await page.keyboard.press('ArrowRight');
		await expect(label(page)).toHaveText('2/5 · Team Building');
		await expect(carousel(page)).toBeFocused();
		await page.keyboard.press('End');
		await expect(label(page)).toHaveText('5/5 · Fun Games');
		await page.keyboard.press('ArrowRight');
		await expect(label(page)).toHaveText('1/5 · Offroad');
		await page.keyboard.press('ArrowLeft');
		await expect(label(page)).toHaveText('5/5 · Fun Games');
		await page.keyboard.press('Home');
		await expect(label(page)).toHaveText('1/5 · Offroad');
		await expect(carousel(page)).toBeFocused();
	});
});

test.describe('[package-catalog] Tautan langsung ke paket', () => {
	test('memilih slide memperbarui hash tanpa menambah entri history', async ({ page }) => {
		await gotoReady(page, '/');
		const before = await page.evaluate(() => history.length);
		await dot(page, 'Rafting').click();
		await expect.poll(() => page.evaluate(() => location.hash)).toBe('#paket-rafting');
		await dot(page, 'Paintball').click();
		await expect.poll(() => page.evaluate(() => location.hash)).toBe('#paket-paintball');
		expect(await page.evaluate(() => history.length)).toBe(before);
	});

	test('/#paket-rafting membuka slide Rafting dan section Paket terlihat', async ({ page }) => {
		await gotoReady(page, '/#paket-rafting');
		await expect(label(page)).toHaveText('3/5 · Rafting');
		await expect(activeSlide(page).getByRole('heading', { level: 3 })).toHaveText('Rafting');
		await expect
			.poll(() => page.locator('#paket').evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < 400 && r.bottom > 0; }))
			.toBe(true);
	});

	test('hash tidak dikenal diabaikan: slide pertama tanpa galat', async ({ page }) => {
		await gotoReady(page, '/#paket-tidak-ada');
		await expect(label(page)).toHaveText('1/5 · Offroad');
	});

	test('mengubah hash saat berada di halaman memilih slide terkait', async ({ page }) => {
		await gotoReady(page, '/');
		await page.evaluate(() => { location.hash = '#paket-fun-games'; });
		await expect(label(page)).toHaveText('5/5 · Fun Games');
	});
});

test.describe('[package-catalog] Isi slide dan tampilan harga', () => {
	test('Offroad: harga berformat rupiah dan keterangan per orang', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(activeSlide(page)).toContainText('Rp 250.000');
		await expect(activeSlide(page)).toContainText('/ orang');
	});

	test('paket tanpa harga menampilkan "Harga menyusul"', async ({ page }) => {
		await gotoReady(page, '/');
		await dot(page, 'Team Building').click();
		await expect(activeSlide(page)).toContainText('Harga menyusul');
	});

	test('Rafting: harga dan "Minimal 10 peserta"', async ({ page }) => {
		await gotoReady(page, '/');
		await dot(page, 'Rafting').click();
		await expect(activeSlide(page)).toContainText('Rp 200.000');
		await expect(activeSlide(page)).toContainText('Minimal 10 peserta');
	});

	test('slide memuat gambar dengan teks alternatif, ringkasan, dan daftar fasilitas', async ({ page }) => {
		await gotoReady(page, '/');
		const panel = activeSlide(page);
		await expect(panel.locator('img')).toHaveAttribute('alt', /.+/);
		await expect(panel.locator('ul li')).not.toHaveCount(0);
		await expect(panel.getByText('Pilihan yang dapat dibahas')).toBeVisible();
	});

	test('semua slide ada di HTML awal (terbaca tanpa JavaScript)', async ({ request }) => {
		const html = await (await request.get('/')).text();
		for (const n of NAMES) expect(html, n).toContain(n);
		expect((html.match(/aria-roledescription="slide"/g) ?? []).length).toBe(5);
	});
});
