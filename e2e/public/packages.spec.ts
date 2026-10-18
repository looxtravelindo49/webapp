import type { Page } from '@playwright/test';
import { expect, gotoReady, test } from '../support/fixtures';

const NAMES = ['Offroad', 'Team Building', 'Rafting', 'Paintball', 'Fun Games'];
const tab = (page: Page, name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const activePanel = (page: Page) => page.locator('[role=tabpanel]:not([hidden])');
const selectedTabs = (page: Page) => page.getByRole('tab', { selected: true });

test.describe('[package-catalog] Paket tampil sebagai tab', () => {
	test('lima tab berurutan, tab pertama terpilih, hanya satu panel terlihat', async ({ page }) => {
		await gotoReady(page, '/');
		const labels = (await page.getByRole('tab').allInnerTexts()).map((t) => t.trim());
		expect(labels).toEqual(NAMES);
		await expect(selectedTabs(page)).toHaveCount(1);
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'true');
		await expect(activePanel(page)).toHaveCount(1);
		await expect(activePanel(page).getByRole('heading', { level: 3 })).toHaveText('Offroad');
	});

	test('klik tab menampilkan panelnya dan menyembunyikan panel lain', async ({ page }) => {
		await gotoReady(page, '/');
		await tab(page, 'Rafting').click();
		await expect(tab(page, 'Rafting')).toHaveAttribute('aria-selected', 'true');
		await expect(activePanel(page)).toHaveCount(1);
		await expect(activePanel(page).getByRole('heading', { level: 3 })).toHaveText('Rafting');
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'false');
	});

	test('roving tabindex: hanya tab terpilih yang bisa dicapai dengan Tab', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(tab(page, 'Offroad')).toHaveAttribute('tabindex', '0');
		for (const n of NAMES.slice(1)) await expect(tab(page, n)).toHaveAttribute('tabindex', '-1');
		await tab(page, 'Paintball').click();
		await expect(tab(page, 'Paintball')).toHaveAttribute('tabindex', '0');
		await expect(tab(page, 'Offroad')).toHaveAttribute('tabindex', '-1');
	});

	test('ARIA: tab menunjuk panel yang berlabel tab itu', async ({ page }) => {
		await gotoReady(page, '/');
		const controls = await tab(page, 'Offroad').getAttribute('aria-controls');
		const panel = page.locator(`#${controls}`);
		await expect(panel).toHaveAttribute('role', 'tabpanel');
		await expect(panel).toHaveAttribute('aria-labelledby', (await tab(page, 'Offroad').getAttribute('id'))!);
		await expect(page.getByRole('tablist')).toHaveCount(1);
	});
});

test.describe('[package-catalog] Navigasi keyboard tab', () => {
	test('panah kanan/kiri berputar, Home dan End melompat, fokus mengikuti', async ({ page }) => {
		await gotoReady(page, '/');
		await tab(page, 'Offroad').focus();
		await page.keyboard.press('ArrowRight');
		await expect(tab(page, 'Team Building')).toBeFocused();
		await expect(tab(page, 'Team Building')).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('End');
		await expect(tab(page, 'Fun Games')).toBeFocused();
		await expect(tab(page, 'Fun Games')).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ArrowRight');
		await expect(tab(page, 'Offroad')).toBeFocused();
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ArrowLeft');
		await expect(tab(page, 'Fun Games')).toBeFocused();
		await page.keyboard.press('Home');
		await expect(tab(page, 'Offroad')).toBeFocused();
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'true');
	});
});

test.describe('[package-catalog] Tautan langsung ke tab', () => {
	test('memilih tab memperbarui hash tanpa menambah entri history', async ({ page }) => {
		await gotoReady(page, '/');
		const before = await page.evaluate(() => history.length);
		await tab(page, 'Rafting').click();
		await expect.poll(() => page.evaluate(() => location.hash)).toBe('#paket-rafting');
		await tab(page, 'Paintball').click();
		await expect.poll(() => page.evaluate(() => location.hash)).toBe('#paket-paintball');
		expect(await page.evaluate(() => history.length)).toBe(before);
	});

	test('/#paket-rafting membuka tab Rafting dan section Paket terlihat', async ({ page }) => {
		await gotoReady(page, '/#paket-rafting');
		await expect(tab(page, 'Rafting')).toHaveAttribute('aria-selected', 'true');
		await expect
			.poll(() => page.locator('#paket').evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < 400 && r.bottom > 0; }))
			.toBe(true);
	});

	test('hash tidak dikenal diabaikan: tab pertama terpilih tanpa galat', async ({ page }) => {
		await gotoReady(page, '/#paket-tidak-ada');
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'true');
	});

	test('mengubah hash saat berada di halaman memilih tab terkait', async ({ page }) => {
		await gotoReady(page, '/');
		await page.evaluate(() => { location.hash = '#paket-fun-games'; });
		await expect(tab(page, 'Fun Games')).toHaveAttribute('aria-selected', 'true');
	});
});

test.describe('[package-catalog] Isi panel dan tampilan harga', () => {
	test('Offroad: harga berformat rupiah dan keterangan per orang', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(activePanel(page)).toContainText('Rp 250.000');
		await expect(activePanel(page)).toContainText('/ orang');
	});

	test('paket tanpa harga menampilkan "Harga menyusul"', async ({ page }) => {
		await gotoReady(page, '/');
		await tab(page, 'Team Building').click();
		await expect(activePanel(page)).toContainText('Harga menyusul');
	});

	test('Rafting: harga dan "Minimal 10 peserta"', async ({ page }) => {
		await gotoReady(page, '/');
		await tab(page, 'Rafting').click();
		await expect(activePanel(page)).toContainText('Rp 200.000');
		await expect(activePanel(page)).toContainText('Minimal 10 peserta');
	});

	test('panel memuat gambar dengan teks alternatif, ringkasan, dan daftar fasilitas', async ({ page }) => {
		await gotoReady(page, '/');
		const panel = activePanel(page);
		await expect(panel.locator('img')).toHaveAttribute('alt', /.+/);
		await expect(panel.locator('ul li')).not.toHaveCount(0);
		await expect(panel.getByText('Pilihan yang dapat dibahas')).toBeVisible();
	});

	test('semua panel ada di HTML awal (terbaca tanpa JavaScript)', async ({ request }) => {
		const html = await (await request.get('/')).text();
		for (const n of NAMES) expect(html, n).toContain(n);
		expect((html.match(/role="tabpanel"/g) ?? []).length).toBe(5);
	});
});
