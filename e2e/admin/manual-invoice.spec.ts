import { adminLogin } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[manual-invoice] Buat invoice dari admin', () => {
	test('menyimpan baris bebas dan menampilkannya di invoice publik', async ({ page }) => {
		const login = uniqueLogin('manual');
		insertAdmin(login, 'sandi-uji-manual-1');
		await adminLogin(page, login, 'sandi-uji-manual-1');
		await gotoReady(page, '/admin/leads');
		await page.getByRole('link', { name: 'Buat Invoice Manual' }).click();
		await expect(page).toHaveURL(/\/admin\/leads\/baru$/);

		await page.getByLabel('Nama klien').fill('Sari Manual');
		await page.getByLabel('Perusahaan (opsional)').fill('PT Contoh');
		await page.getByLabel('No. WA').fill('081298765432');
		await page.getByLabel('Jumlah peserta').fill('8');
		await page.getByLabel('Tanggal acara').fill('2026-12-02');
		await page.getByLabel('Deskripsi').fill('Jeep hutan pinus');
		await page.getByLabel('Qty').fill('2');
		await page.getByLabel('Harga satuan').fill('249000');
		await page.getByLabel('Diskon (opsional)').fill('49000');
		await expect(page.getByText('Total Rp 449.000')).toBeVisible();
		await expect(page.getByText('DP 30% Rp 134.700')).toBeVisible();
		await page.getByRole('button', { name: 'Simpan invoice' }).click();

		await expect(page).toHaveURL(/\/admin\/leads\/LA-\d{8}-[A-Z2-9]{8}\?baru=1$/);
		await expect(page.getByText('Invoice tersimpan.')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Salin tautan' })).toBeVisible();
		const nomor = new URL(page.url()).pathname.split('/').pop()!;
		const link = page.getByRole('link', { name: /Kirim ke WA klien/ });
		await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/6281298765432\?text=/);
		expect(decodeURIComponent((await link.getAttribute('href')) ?? '')).toContain(nomor);

		await gotoReady(page, `/invoice/${nomor}`);
		const sheet = page.locator('.invoice-sheet');
		await expect(sheet.getByRole('heading', { level: 1 })).toHaveText('Invoice Estimasi');
		await expect(sheet.getByText('Jeep hutan pinus')).toBeVisible();
		await expect(sheet.getByText('2 × Rp 249.000')).toBeVisible();
		await expect(sheet.getByText('PT Contoh')).toBeVisible();
		await expect(sheet.getByText('Rp 449.000')).toBeVisible();
		await expect(sheet.getByText('860025788700', { exact: true })).toBeVisible();
		await expect(sheet.getByRole('link', { name: 'Kebijakan pembayaran' })).toHaveAttribute('href', '/kebijakan-pembayaran');
		const res = await page.request.get(`/invoice/${nomor}`);
		expect(res.headers()['cache-control'] ?? '').toContain('no-store');
	});
});
