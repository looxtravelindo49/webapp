import { expect, gotoReady, test } from '../support/fixtures';

const chat = (page: import('@playwright/test').Page) => page.getByRole('link', { name: 'Chat kami di WhatsApp' });

test.describe('[site-shell] Tombol chat WhatsApp', () => {
	test('tampil di halaman publik dengan template, tersembunyi di admin', async ({ page }) => {
		await gotoReady(page, '/');
		const href = await chat(page).getAttribute('href');
		const text = decodeURIComponent(new URL(href!).searchParams.get('text')!);
		expect(text).toContain('Halooo LembangAdventure.com !\nSaya mau konsultasi trip/outbound di Lembang.');
		expect(text).toContain('Pilihan Activity: \n');
		expect(text).toContain('Mohon info paket dan penawarannya ya, terima kasih!');
		await expect(chat(page)).toContainText('Chat kami');

		await page.setViewportSize({ width: 360, height: 740 });
		await expect(chat(page).getByText('Chat kami', { exact: true })).toBeHidden();
		await expect(chat(page)).toBeVisible();

		await gotoReady(page, '/admin/login');
		await expect(page.getByRole('link', { name: 'Chat kami di WhatsApp' })).toHaveCount(0);
	});

	test('halaman paket mengisi nama kegiatan', async ({ page }) => {
		await gotoReady(page, '/paket/offroad');
		const href = await chat(page).getAttribute('href');
		const text = decodeURIComponent(new URL(href!).searchParams.get('text')!);
		expect(text).toContain('Pilihan Activity: Offroad\n');
	});
});
