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

	test('edit, fee, DP manual, Include, dan PDF tanpa chrome situs', async ({ page }) => {
		const login = uniqueLogin('manualedit');
		insertAdmin(login, 'sandi-uji-manual-2');
		await adminLogin(page, login, 'sandi-uji-manual-2');
		await gotoReady(page, '/admin/leads/baru');

		await page.getByLabel('Nama klien').fill('Raka Edit');
		await page.getByLabel('Perusahaan (opsional)').fill('PT Raka');
		await page.getByLabel('No. WA').fill('081200011122');
		await page.getByLabel('Jumlah peserta').fill('10');
		await page.getByLabel('Deskripsi').fill('Jeep hutan pinus');
		await page.getByLabel('Qty').fill('2');
		await page.getByLabel('Harga satuan').fill('249000');
		await page.getByLabel('Include').fill('Pemandu hutan\nMakan siang');
		await page.getByLabel('Diskon (opsional)').fill('49000');
		await page.getByLabel('Tambahkan baris Fee Services').check();
		await page.getByLabel('Persen (contoh 10 atau 10,5)').fill('10');
		await page.getByRole('group', { name: 'Uang muka (DP)' }).getByLabel('Nominal tetap').check();
		await page.getByLabel('Nominal DP').fill('200000');
		await expect(page.getByText('Total Rp 493.900')).toBeVisible();
		await expect(page.getByText('DP Rp 200.000')).toBeVisible();
		await page.getByRole('button', { name: 'Simpan invoice' }).click();

		await expect(page).toHaveURL(/\/admin\/leads\/LA-\d{8}-[A-Z2-9]{8}\?baru=1$/);
		const nomor = new URL(page.url()).pathname.split('/').pop()!;
		await gotoReady(page, `/invoice/${nomor}`);
		const sheet = page.locator('.invoice-sheet');
		await expect(sheet.getByText('Pemandu hutan')).toBeVisible();
		await expect(sheet.getByText('Makan siang')).toBeVisible();
		await expect(sheet.getByText('Include', { exact: true })).toBeVisible();
		await expect(sheet.getByText('Fee Services')).toBeVisible();
		await expect(sheet.getByText('Rp 493.900')).toBeVisible();
		await expect(sheet.getByText('Rp 200.000')).toBeVisible();
		await expect(sheet.getByRole('button', { name: 'Bayar DP 30% (segera)' })).toHaveCount(0);
		await expect(sheet.getByText('860025788700', { exact: true })).toBeVisible();
		await expect(sheet.getByText('Hati-hati memilih travel. Pastikan travel sudah berbadan hukum PT')).toBeVisible();
		await expect(sheet.getByRole('link', { name: /Kirim bukti transfer/ })).toHaveAttribute('href', /wa\.me\/6282120209900\?text=/);
		await expect(page.locator('header.print-hide')).toBeVisible();

		await gotoReady(page, `/admin/leads/${nomor}/ubah`);
		await expect(page.getByLabel('Nama klien')).toHaveValue('Raka Edit');
		await expect(page.getByLabel('Include')).toHaveValue('Pemandu hutan\nMakan siang');
		await page.getByLabel('Harga satuan').fill('300000');
		await page.getByLabel('Judul baris').fill('Service Charge');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();
		await expect(page.getByText('Perubahan invoice disimpan. Halaman publik memakai data terbaru.')).toBeVisible();

		await gotoReady(page, `/invoice/${nomor}`);
		await expect(page.locator('.invoice-sheet').getByText('Service Charge')).toBeVisible();
		await expect(page.locator('.invoice-sheet').getByText('Rp 606.100')).toBeVisible();
		await expect(page.locator('.invoice-sheet').getByText('Rp 200.000')).toBeVisible();

		await page.emulateMedia({ media: 'print' });
		await expect(page.locator('header.print-hide')).toBeHidden();
		await expect(page.locator('footer.print-hide')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Export PDF' })).toBeHidden();
		await expect(page.locator('.invoice-sheet')).toBeVisible();
		await expect(page.locator('.invoice-sheet').getByText('860025788700', { exact: true })).toBeVisible();
		const printed = await page.locator('.invoice-sheet').evaluate((el) => {
			const row = el.querySelector('.invoice-line');
			const bar = el.querySelector('.invoice-brand-bar');
			const total = el.querySelector('.invoice-total-figure');
			return {
				font: getComputedStyle(el).fontFamily,
				breakInside: row ? getComputedStyle(row).breakInside : '',
				bar: bar ? getComputedStyle(bar).backgroundColor : '',
				lime: total ? getComputedStyle(total).backgroundColor : ''
			};
		});
		expect(printed.font.toLowerCase()).toContain('urbanist');
		expect(printed.breakInside).toBe('avoid');
		expect(printed.bar).toBe('rgb(13, 1, 255)');
		expect(printed.lime).toBe('rgb(229, 255, 0)');
	});
});
