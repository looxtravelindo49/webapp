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

test.describe('[site-shell] Inspirasi membuka artikel', () => {
	test('tiga kartu artikel; mengaktifkan kartu membuka dialog berisi isi artikel', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.locator('#inspirasi').getByRole('button')).toHaveCount(3);
		await page.locator('#inspirasi').getByRole('button').first().click();
		await expect(openDialog(page)).toContainText('Lima hal ini sudah cukup');
		await page.keyboard.press('Escape');
		await expect(openDialog(page)).toHaveCount(0);
	});

	test('artikel dapat dibuka dengan keyboard (Enter) dan menutup dengan Esc', async ({ page }) => {
		await gotoReady(page, '/');
		await page.locator('#inspirasi').getByRole('button').nth(1).focus();
		await page.keyboard.press('Enter');
		await expect(openDialog(page)).toContainText('Kenali selera timmu');
		await page.keyboard.press('Escape');
		await expect(page.locator('#inspirasi').getByRole('button').nth(1)).toBeFocused();
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
		await expect(page.locator('footer').getByRole('link', { name: /Bikin cerita/ })).toHaveAttribute('href', '#rencanakan');
	});

	test('Hero tanpa formulir pencarian dan menyebut kelima kegiatan', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.getByRole('searchbox')).toHaveCount(0);
		await expect(page.locator('main > section').first()).toContainText(/OFFROAD.*TEAM BUILDING.*RAFTING.*PAINTBALL.*FUN GAMES/);
	});
});
