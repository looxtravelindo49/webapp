import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[site-settings] CTA WhatsApp', () => {
	test('tombol konsultasi menuju #konsultasi; chat mengambang memakai wa.me', async ({ page, request }) => {
		const html = await (await request.get('/')).text();
		expect(html).toContain('https://wa.me/6282120209900?text=');
		await gotoReady(page, '/');
		const hrefs = await page.locator('header').getByRole('link', { name: 'Konsultasi Trip' }).evaluateAll((els) => els.map((e) => e.getAttribute('href')));
		expect(hrefs.length).toBeGreaterThan(0);
		expect(hrefs.every((h) => h === '/#konsultasi')).toBe(true);
		await expect(page.locator('#konsultasi a[href^="https://wa.me"]')).toHaveCount(0);
		const chat = page.getByRole('link', { name: 'Chat kami di WhatsApp' });
		await expect(chat).toHaveAttribute('href', /^https:\/\/wa\.me\/6282120209900\?text=/);
		await expect(chat).toHaveAttribute('target', '_blank');
	});

	test('aksi WhatsApp tersedia di hasil kalkulator bila nomor valid', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.locator('#konsultasi').getByRole('button', { name: /Booking via WhatsApp/ })).toBeVisible();
	});
});
