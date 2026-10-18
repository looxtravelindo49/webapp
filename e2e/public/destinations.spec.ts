import type { Page } from '@playwright/test';
import { expect, gotoReady, test } from '../support/fixtures';

const card = (page: Page, place: string) => page.locator('#destinasi').getByRole('button', { name: new RegExp(place) });
const openDialog = (page: Page) => page.locator('dialog[open]');
const top = (page: Page, sel: string) => page.locator(sel).evaluate((e) => e.getBoundingClientRect().top);

test.describe('[site-shell] Destinasi membuka detail ide perjalanan', () => {
	test('tiga kartu destinasi: Lembang, Pangandaran, Garut', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.locator('#destinasi').getByRole('button')).toHaveCount(3);
		for (const p of ['Lembang', 'Pangandaran', 'Garut']) await expect(card(page, p)).toBeVisible();
	});

	test('membuka dialog: isi ide, fokus masuk ke dialog', async ({ page }) => {
		await gotoReady(page, '/');
		await card(page, 'Pangandaran').click();
		await expect(openDialog(page)).toHaveCount(1);
		await expect(openDialog(page).getByRole('heading', { level: 2 })).toContainText('debur ombak');
		await expect(openDialog(page)).toContainText('2 hari 1 malam');
		expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
		await expect(openDialog(page)).toHaveAttribute('aria-labelledby', /.+/);
	});

	test('Esc menutup dialog dan fokus kembali ke kartu', async ({ page }) => {
		await gotoReady(page, '/');
		await card(page, 'Pangandaran').click();
		await expect(openDialog(page)).toHaveCount(1);
		await page.keyboard.press('Escape');
		await expect(openDialog(page)).toHaveCount(0);
		await expect(card(page, 'Pangandaran')).toBeFocused();
	});

	test('tombol Tutup dan klik di luar dialog (backdrop) menutup dialog', async ({ page }) => {
		await gotoReady(page, '/');
		await card(page, 'Garut').click();
		await openDialog(page).getByRole('button', { name: 'Tutup dialog' }).click();
		await expect(openDialog(page)).toHaveCount(0);
		await card(page, 'Garut').click();
		await expect(openDialog(page)).toHaveCount(1);
		await page.mouse.click(5, 5);
		await expect(openDialog(page)).toHaveCount(0);
	});

	test('"Konsultasi ide ini" menutup dialog dan menggulir ke #konsultasi tanpa menarik fokus kembali ke kartu', async ({ page }) => {
		await gotoReady(page, '/');
		await card(page, 'Pangandaran').click();
		await openDialog(page).getByRole('link', { name: 'Konsultasi ide ini' }).click();
		await expect(openDialog(page)).toHaveCount(0);
		const nh = (await page.locator('header').first().boundingBox())!.height;
		await expect.poll(() => top(page, '#konsultasi')).toBeGreaterThanOrEqual(nh - 2);
		await expect.poll(() => top(page, '#konsultasi')).toBeLessThan(200);
		await expect(page.locator('#konsultasi')).toBeFocused();
		await expect(card(page, 'Pangandaran')).not.toBeFocused();
	});

	test('setelah itu, menutup dialog lain dengan Esc tetap mengembalikan fokus ke kartunya', async ({ page }) => {
		await gotoReady(page, '/');
		await card(page, 'Pangandaran').click();
		await openDialog(page).getByRole('link', { name: 'Konsultasi ide ini' }).click();
		await expect(openDialog(page)).toHaveCount(0);
		await card(page, 'Garut').click();
		await page.keyboard.press('Escape');
		await expect(card(page, 'Garut')).toBeFocused();
	});
});

test.describe('[site-shell] Artikel populer di beranda', () => {
	const cards = (page: Page) => page.locator('#artikel-populer').locator('a[href^="/artikel/"]');

	test('tiga kartu artikel tertaut (bukan dialog) dan tautan "Lihat semua artikel"', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(cards(page)).toHaveCount(3);
		await expect(page.locator('#artikel-populer').getByRole('button')).toHaveCount(0);
		await expect(page.locator('#artikel-populer').getByRole('link', { name: /Lihat semua artikel/ })).toHaveAttribute('href', '/artikel');
	});

	test('setiap kartu memuat gambar sampul 16:9 yang termuat, di atas kategori dan judul', async ({ page }) => {
		await gotoReady(page, '/');
		const list = cards(page);
		await expect(list).toHaveCount(3);
		for (let i = 0; i < 3; i++) {
			const card = list.nth(i);
			const img = card.locator('img');
			await expect(img).toHaveCount(1);
			await img.scrollIntoViewIfNeeded();
			await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
			const [imgBox, titleBox] = [await img.boundingBox(), await card.getByRole('heading', { level: 3 }).boundingBox()];
			expect(imgBox!.y).toBeLessThan(titleBox!.y);
			expect(Math.abs(imgBox!.width / imgBox!.height - 16 / 9)).toBeLessThan(0.05);
		}
	});

	test('360 px: kartu bertumpuk satu kolom dan tanpa scroll horizontal', async ({ page }) => {
		await page.setViewportSize({ width: 360, height: 800 });
		await gotoReady(page, '/');
		const boxes = await Promise.all([0, 1, 2].map((i) => cards(page).nth(i).boundingBox()));
		expect(new Set(boxes.map((b) => Math.round(b!.x))).size).toBe(1);
		expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});

	test('mengklik kartu membuka halaman artikel dengan isinya', async ({ page }) => {
		await gotoReady(page, '/');
		await cards(page).first().click();
		await expect(page).toHaveURL(/\/artikel\/[a-z0-9-]+$/);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Sepakati 5 hal');
		await expect(page.locator('.article-body')).toContainText('Lima hal ini sudah cukup');
	});

	test('kartu dapat dibuka dengan keyboard (Enter)', async ({ page }) => {
		await gotoReady(page, '/');
		await cards(page).nth(1).focus();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/\/artikel\/offroad-atau-pantai/);
	});
});

test.describe('[site-shell] Section Sudah punya bayangan', () => {
	test('judul, tiga langkah bernomor 01–03, dan tombol Mulai rencanakan', async ({ page }) => {
		await gotoReady(page, '/');
		const s = page.locator('#rencanakan');
		await expect(s.getByRole('heading', { level: 2 })).toContainText('Sudah punya bayangan?');
		const steps = await s.locator('ol li').allInnerTexts();
		expect(steps).toHaveLength(3);
		expect(steps.map((t) => t.trim().slice(0, 2))).toEqual(['01', '02', '03']);
		await expect(s.getByRole('link', { name: 'Mulai rencanakan' })).toHaveAttribute('href', '#konsultasi');
	});
});

test.describe('[site-shell] Footer dan Hero', () => {
	test('Footer menampilkan tahun berjalan dan tautan ke #rencanakan', async ({ page }) => {
		await gotoReady(page, '/');
		// Satu-satunya tes yang sengaja memakai tanggal hari ini: yang diuji memang "tahun berjalan" (dirender dari jam server).
		await expect(page.locator('footer')).toContainText(`© ${new Date().getFullYear()}`);
		await expect(page.locator('footer').getByRole('link', { name: /Bikin cerita/ })).toHaveAttribute('href', '/#rencanakan');
	});

	test('Hero tanpa formulir pencarian dan menyebut kelima kegiatan', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.getByRole('searchbox')).toHaveCount(0);
		await expect(page.locator('main > section').first()).toContainText(/OFFROAD.*TEAM BUILDING.*RAFTING.*PAINTBALL.*FUN GAMES/);
	});
});
