import type { Page } from '@playwright/test';
import { expect, gotoReady, test } from '../support/fixtures';

const NAMES = ['Offroad', 'Team Building', 'Rafting', 'Paintball', 'Fun Games'];
const carousel = (page: Page) => page.getByRole('region', { name: 'Paket kegiatan' });
const tab = (page: Page, name: string) => page.locator('#paket').getByRole('tab', { name, exact: true });
const activeSlide = (page: Page) => page.locator('#paket [aria-roledescription="slide"]:not([inert])');

test.describe('[package-catalog] Paket tampil sebagai slider dengan pil', () => {
	test('lima pil berurutan, pil pertama terpilih, hanya satu slide yang bisa dioperasikan', async ({ page }) => {
		await gotoReady(page, '/');
		const labels = (await page.locator('#paket').getByRole('tab').allInnerTexts()).map((t) => t.trim());
		expect(labels).toEqual(NAMES);
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'true');
		await expect(activeSlide(page)).toHaveCount(1);
		await expect(activeSlide(page).getByRole('heading', { level: 3 })).toHaveText('Offroad');
		await expect(page.locator('#paket').getByRole('tablist')).toHaveCount(1);
	});

	test('klik pil dan panah menampilkan slide yang diminta', async ({ page }) => {
		await gotoReady(page, '/');
		await tab(page, 'Rafting').click();
		await expect(activeSlide(page).getByRole('heading', { level: 3 })).toHaveText('Rafting');
		await expect(tab(page, 'Rafting')).toHaveAttribute('aria-selected', 'true');
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'false');

		await page.getByRole('button', { name: 'Paket berikutnya' }).click();
		await expect(tab(page, 'Paintball')).toHaveAttribute('aria-selected', 'true');
		await expect(activeSlide(page).getByRole('heading', { level: 3 })).toHaveText('Paintball');
		await page.getByRole('button', { name: 'Paket sebelumnya' }).click();
		await expect(tab(page, 'Rafting')).toHaveAttribute('aria-selected', 'true');
	});

	test('geser slider memperbarui pil yang aktif', async ({ page }) => {
		await gotoReady(page, '/');
		const scroller = page.locator('#paket [aria-roledescription="carousel"] > ul');
		await scroller.evaluate((el) => {
			el.scrollLeft = el.clientWidth * 2;
		});
		await expect(tab(page, 'Rafting')).toHaveAttribute('aria-selected', 'true');
		await expect(activeSlide(page).getByRole('heading', { level: 3 })).toHaveText('Rafting');
	});

	test('ARIA: carousel, slide, dan tab terhubung', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(carousel(page)).toHaveAttribute('aria-roledescription', 'carousel');
		await expect(carousel(page)).toHaveAttribute('tabindex', '0');
		await expect(page.locator('#paket [aria-roledescription="slide"]')).toHaveCount(5);
		await expect(activeSlide(page)).toHaveAttribute('aria-label', '1 dari 5: Offroad');
		const controls = await tab(page, 'Offroad').getAttribute('aria-controls');
		await expect(activeSlide(page)).toHaveAttribute('id', controls!);
		await expect(page.getByRole('button', { name: 'Paket berikutnya' })).toBeVisible();
	});

	test('di ponsel baris pil satu baris, tidak membungkus, dan pil berikutnya mengintip', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 740 });
		await gotoReady(page, '/');
		const row = page.locator('#paket').getByRole('tablist');
		const metrics = await row.evaluate((el) => {
			const kids = [...el.children] as HTMLElement[];
			const rowRect = el.getBoundingClientRect();
			const peek = kids.some((k) => {
				const r = k.getBoundingClientRect();
				return r.left < rowRect.right - 8 && r.right > rowRect.right + 1;
			});
			return {
				nowrap: getComputedStyle(el).flexWrap === 'nowrap',
				overflow: el.scrollWidth > el.clientWidth + 1,
				peek
			};
		});
		expect(metrics.nowrap).toBe(true);
		expect(metrics.overflow).toBe(true);
		expect(metrics.peek).toBe(true);
		await expect(page.locator('#paket [data-tab-fade]')).toBeVisible();
	});

	test('pil aktif tergulir ke dalam baris tab', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 740 });
		await gotoReady(page, '/');
		await tab(page, 'Fun Games').click();
		await expect(tab(page, 'Fun Games')).toHaveAttribute('aria-selected', 'true');
		await expect
			.poll(() =>
				page.locator('#paket').getByRole('tablist').evaluate((el) => {
					const tab = el.querySelector('[aria-selected="true"]') as HTMLElement;
					const row = el.getBoundingClientRect();
					const r = tab.getBoundingClientRect();
					return r.left >= row.left - 2 && r.right <= row.right + 2;
				})
			)
			.toBe(true);
	});
});

test.describe('[package-catalog] Navigasi keyboard slider', () => {
	test('panah kanan/kiri berputar, Home dan End melompat, pil ikut, fokus tetap di carousel', async ({ page }) => {
		await gotoReady(page, '/');
		await carousel(page).focus();
		await page.keyboard.press('ArrowRight');
		await expect(tab(page, 'Team Building')).toHaveAttribute('aria-selected', 'true');
		await expect(carousel(page)).toBeFocused();
		await page.keyboard.press('End');
		await expect(tab(page, 'Fun Games')).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ArrowRight');
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('ArrowLeft');
		await expect(tab(page, 'Fun Games')).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('Home');
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'true');
		await expect(carousel(page)).toBeFocused();
	});

	test('panah pada pil memindahkan pilihan dan fokus', async ({ page }) => {
		await gotoReady(page, '/');
		await tab(page, 'Offroad').focus();
		await page.keyboard.press('ArrowRight');
		await expect(tab(page, 'Team Building')).toBeFocused();
		await expect(tab(page, 'Team Building')).toHaveAttribute('aria-selected', 'true');
		await page.keyboard.press('End');
		await expect(tab(page, 'Fun Games')).toBeFocused();
		await page.keyboard.press('Home');
		await expect(tab(page, 'Offroad')).toBeFocused();
	});
});

test.describe('[package-catalog] Tautan langsung ke paket', () => {
	test('memilih pil memperbarui hash tanpa menambah entri history', async ({ page }) => {
		await gotoReady(page, '/');
		const before = await page.evaluate(() => history.length);
		await tab(page, 'Rafting').click();
		await expect.poll(() => page.evaluate(() => location.hash)).toBe('#paket-rafting');
		await tab(page, 'Paintball').click();
		await expect.poll(() => page.evaluate(() => location.hash)).toBe('#paket-paintball');
		expect(await page.evaluate(() => history.length)).toBe(before);
	});

	test('/#paket-rafting membuka slide Rafting dan section Paket terlihat', async ({ page }) => {
		await gotoReady(page, '/#paket-rafting');
		await expect(tab(page, 'Rafting')).toHaveAttribute('aria-selected', 'true');
		await expect(activeSlide(page).getByRole('heading', { level: 3 })).toHaveText('Rafting');
		await expect
			.poll(() => page.locator('#paket').evaluate((e) => { const r = e.getBoundingClientRect(); return r.top < 400 && r.bottom > 0; }))
			.toBe(true);
	});

	test('hash tidak dikenal diabaikan: slide pertama tanpa galat', async ({ page }) => {
		await gotoReady(page, '/#paket-tidak-ada');
		await expect(tab(page, 'Offroad')).toHaveAttribute('aria-selected', 'true');
	});

	test('mengubah hash saat berada di halaman memilih slide terkait', async ({ page }) => {
		await gotoReady(page, '/');
		await page.evaluate(() => { location.hash = '#paket-fun-games'; });
		await expect(tab(page, 'Fun Games')).toHaveAttribute('aria-selected', 'true');
	});
});

test.describe('[package-catalog] Isi slide dan tampilan harga', () => {
	test('Offroad: harga berformat rupiah dan keterangan per orang', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(activeSlide(page)).toContainText('Rp 250.000');
		await expect(activeSlide(page)).toContainText('/ orang');
	});

	test('Team Building menampilkan harga Rp125.000 dan minimal 20 peserta', async ({ page }) => {
		await gotoReady(page, '/');
		await tab(page, 'Team Building').click();
		await expect(activeSlide(page)).toContainText('Rp 125.000');
		await expect(activeSlide(page)).toContainText('Minimal 20 peserta');
	});

	test('Rafting: harga dan "Minimal 10 peserta"', async ({ page }) => {
		await gotoReady(page, '/');
		await tab(page, 'Rafting').click();
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
		const start = html.indexOf('id="paket"');
		const end = html.indexOf('id="konsultasi"', start);
		expect(start, 'section paket').toBeGreaterThan(-1);
		expect(end, 'section konsultasi setelah paket').toBeGreaterThan(start);
		const section = html.slice(start, end);
		for (const n of NAMES) expect(section, n).toContain(n);
		expect((section.match(/aria-roledescription="slide"/g) ?? []).length).toBe(5);
		expect((section.match(/role="tab"/g) ?? []).length).toBe(5);
	});
});
