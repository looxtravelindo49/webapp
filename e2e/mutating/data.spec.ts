import { calc, fillValid } from '../support/calculator';
import { exec, getSetting, query, setPublished, setSetting } from '../support/db';
import { capturePopups, expect, gotoReady, stubShare, test } from '../support/fixtures';

// File ini sementara mengubah data yang dibaca SEMUA halaman publik. Karena itu ia berada di proyek
// `mutating` (berjalan setelah proyek utama), serial, dan memulihkan data di afterAll.
test.describe.configure({ mode: 'serial' });

type Pkg = { slug: string; published: number; sort_order: number };
let original: Pkg[] = [];
let originalWhatsapp = '';

test.beforeAll(() => {
	original = query<Pkg>('SELECT slug, published, sort_order FROM package');
	originalWhatsapp = getSetting('whatsapp')!;
});
test.afterAll(() => {
	for (const p of original) exec('UPDATE package SET published = ?, sort_order = ? WHERE slug = ?', p.published, p.sort_order, p.slug);
	setSetting('whatsapp', originalWhatsapp);
});

test.describe('[package-catalog] Hanya paket terbit yang tampil', () => {
	test('paket draft hilang dari tab dan dari kalkulator; paket lain tetap berurutan', async ({ page }) => {
		setPublished('rafting', false);
		await gotoReady(page, '/');
		const labels = (await page.locator('#paket h3').allInnerTexts()).map((t) => t.trim());
		expect(labels).toEqual(['Offroad', 'Team Building', 'Paintball', 'Fun Games']);
		await expect(calc(page).packageBoxes).toHaveCount(4);
		await expect(calc(page).root.getByRole('checkbox', { name: /^Rafting/ })).toHaveCount(0);
		setPublished('rafting', true);
	});

	test('urutan mengikuti sort_order', async ({ page }) => {
		exec("UPDATE package SET sort_order = 0 WHERE slug = 'paintball'");
		await gotoReady(page, '/');
		const labels = (await page.locator('#paket h3').allInnerTexts()).map((t) => t.trim());
		expect(labels[0]).toBe('Paintball');
		expect(labels).toHaveLength(5);
	});

	test('semua paket draft: pesan "Paket sedang disiapkan" dan tanpa carousel', async ({ page }) => {
		exec('UPDATE package SET published = 0');
		await gotoReady(page, '/');
		await expect(page.locator('#paket')).toContainText('Paket sedang disiapkan');
		await expect(page.locator('#paket [aria-roledescription="carousel"]')).toHaveCount(0);
		await expect(page.getByRole('tablist')).toHaveCount(0);
		await expect(calc(page).root).toContainText('Paket sedang disiapkan');
	});
});

test.describe('[site-settings] Pengaturan dibaca saat request', () => {
	test.beforeEach(() => {
		// kembalikan paket ke keadaan awal sebelum tes ini
		for (const p of original) exec('UPDATE package SET published = ?, sort_order = ? WHERE slug = ?', p.published, p.sort_order, p.slug);
	});

	test('nomor tidak valid: aksi WhatsApp hilang; Konsultasi Trip tetap ada', async ({ page }) => {
		setSetting('whatsapp', 'abc');
		await gotoReady(page, '/');
		const c = await fillValid(page);
		await expect(c.send).toHaveCount(0);
		await expect(c.root).toContainText('Pengiriman lewat WhatsApp sedang tidak aktif.');
		await expect(c.root.getByRole('button', { name: 'Simpan PDF' })).toHaveCount(0);
		await expect(page.locator('header').getByRole('link', { name: 'Konsultasi Trip' }).first()).toBeAttached();
	});

	test('nomor kosong juga menyembunyikan aksi WhatsApp', async ({ page }) => {
		setSetting('whatsapp', '');
		await gotoReady(page, '/');
		await expect(calc(page).send).toHaveCount(0);
		await expect(calc(page).root).toContainText('Pengiriman lewat WhatsApp sedang tidak aktif.');
	});

	test('mengubah nomor langsung tampil (format lokal dinormalisasi) tanpa restart', async ({ page, context }) => {
		setSetting('whatsapp', '0812-3456-7890');
		await stubShare(context, 'none');
		await capturePopups(context);
		await gotoReady(page, '/');
		const c = await fillValid(page);
		const popupP = context.waitForEvent('page');
		await c.send.click();
		const popup = await popupP;
		await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
	});
});
