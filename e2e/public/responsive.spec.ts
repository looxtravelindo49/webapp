import type { Page } from '@playwright/test';
import { calc, fillValid } from '../support/calculator';
import { expect, gotoReady, test } from '../support/fixtures';

const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const overflowingInCalc = (page: Page) =>
	page.evaluate(() => [...document.querySelectorAll('#konsultasi *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).length);

test.describe('[site-shell] Responsif tanpa scroll horizontal', () => {
	for (const width of [360, 375, 768, 1280]) {
		test(`beranda dan kalkulator terisi pada ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await gotoReady(page, '/');
			expect(await noHorizontalScroll(page)).toBe(true);
			await fillValid(page, { packages: ['Offroad', 'Rafting', 'Fun Games'], team: 'PT Maju Jaya Bersama Sentosa', pax: '40' });
			expect(await noHorizontalScroll(page)).toBe(true);
			expect(await overflowingInCalc(page)).toBe(0);
		});
	}
});

test.describe('[trip-calculator] Tata letak ringkasan', () => {
	const card = (page: Page) => calc(page).summary.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');

	test('di layar lebar ringkasan menempel (sticky) saat menggulir', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await gotoReady(page, '/');
		await calc(page).box('Offroad').check();
		const y = await calc(page).root.evaluate((e) => e.getBoundingClientRect().top + scrollY);
		await page.evaluate((v) => scrollTo(0, v + 260), y);
		await expect.poll(() => card(page).evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBeGreaterThanOrEqual(93);
		await expect.poll(() => card(page).evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBeLessThanOrEqual(99);
	});

	test('di mobile ringkasan tidak sticky dan berada di bawah formulir', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });
		await gotoReady(page, '/');
		expect(await card(page).evaluate((e) => getComputedStyle(e).position)).not.toBe('sticky');
		const form = await calc(page).root.locator('form').boundingBox();
		const summary = await card(page).boundingBox();
		expect(summary!.y).toBeGreaterThan(form!.y + form!.height - 1);
	});
});

test.describe('[trip-calculator] Keyboard pada formulir', () => {
	test('urutan fokus logis dan indikator fokus terlihat', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await gotoReady(page, '/');
		const c = await fillValid(page, { packages: ['Offroad'] });
		await c.team.focus();
		const seen: string[] = [];
		for (let i = 0; i < 20; i++) {
			await page.keyboard.press('Tab');
			seen.push(
				await page.evaluate(() => {
					const e = document.activeElement as HTMLInputElement & HTMLElement;
					return (e.labels?.[0]?.innerText ?? e.innerText ?? e.tagName).split('\n')[0].trim();
				})
			);
			if (seen.at(-1)?.startsWith('Kirim ke WhatsApp')) break;
		}
		const at = (label: string) => seen.findIndex((s) => s.startsWith(label));
		const order = ['Offroad', 'Team Building', 'Rafting', 'Paintball', 'Fun Games', 'Jumlah peserta', 'Tanggal rencana', 'Catatan', 'Kirim ke WhatsApp'];
		const idx = order.map(at);
		expect(idx.every((i) => i >= 0), `semua kontrol dapat dijangkau dengan Tab: ${seen.join(' → ')}`).toBe(true);
		expect([...idx].sort((a, b) => a - b)).toEqual(idx);
		const outline = await page.evaluate(() => {
			const s = getComputedStyle(document.activeElement!);
			return `${s.outlineStyle} ${s.outlineWidth}`;
		});
		expect(outline).toMatch(/solid 3px/);
	});

	test('Spasi mencentang paket yang sedang difokuskan', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Paintball').focus();
		await page.keyboard.press('Space');
		await expect(c.box('Paintball')).toBeChecked();
		await expect(c.tab('Paintball')).toContainText('(dipilih)');
	});
});
