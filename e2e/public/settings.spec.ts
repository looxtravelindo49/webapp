import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[site-settings] CTA WhatsApp', () => {
	test('HTML awal tanpa tautan wa.me; tombol konsultasi menuju #konsultasi', async ({ page, request }) => {
		const html = await (await request.get('/')).text();
		expect(html).not.toContain('wa.me');
		await gotoReady(page, '/');
		const hrefs = await page.locator('header').getByRole('link', { name: 'Konsultasi Trip' }).evaluateAll((els) => els.map((e) => e.getAttribute('href')));
		expect(hrefs.length).toBeGreaterThan(0);
		expect(hrefs.every((h) => h === '/#konsultasi')).toBe(true);
		await expect(page.locator('a[href^="https://wa.me"]')).toHaveCount(0);
	});

	test('aksi WhatsApp tersedia di hasil kalkulator bila nomor valid', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.locator('#konsultasi').getByRole('button', { name: /Kirim ke WhatsApp/ })).toBeVisible();
	});
});
