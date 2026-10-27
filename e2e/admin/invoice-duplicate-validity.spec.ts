import { exec } from '../support/db';
import { adminLogin } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[invoice] Duplikat dan masa berlaku', () => {
	test('menyalin invoice, menghitung waktu, menyembunyikannya saat lunas, dan menandai kedaluwarsa', async ({ page }) => {
		const login = uniqueLogin('duplikat');
		insertAdmin(login, 'sandi-uji-duplikat');
		await adminLogin(page, login, 'sandi-uji-duplikat');
		await gotoReady(page, '/admin/leads/baru');

		await page.getByLabel('Nama klien').fill('Raka Duplikat');
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
		await page.getByRole('button', { name: 'Simpan invoice' }).click();

		await expect(page).toHaveURL(/\/admin\/leads\/LA-\d{8}-[A-Z2-9]{8}\?baru=1$/);
		const nomor = new URL(page.url()).pathname.split('/').pop()!;
		await expect(page.getByRole('button', { name: 'Duplikat invoice' })).toBeVisible();
		await expect(page.getByText('Belum diatur.')).toBeVisible();

		const masa = page.getByRole('group', { name: 'Masa berlaku' });
		await masa.getByLabel('Jam').check();
		await page.getByLabel('Jumlah jam').fill('2');
		await page.getByRole('button', { name: 'Terapkan' }).click();
		await expect(page.getByText('Masa berlaku disimpan.')).toBeVisible();
		const until = (await page.getByText(/Berlaku hingga/).textContent()) ?? '';
		expect(until).toContain('WIB');

		await masa.getByLabel('Hari').check();
		await page.getByLabel('Jumlah hari').fill('1');
		await page.getByRole('button', { name: 'Perpanjang' }).click();
		await expect(page.getByText('Masa berlaku diperpanjang.')).toBeVisible();
		await expect(page.getByText(/Berlaku hingga/)).not.toHaveText(until);

		await gotoReady(page, `/invoice/${nomor}`);
		const countdown = page.locator('.invoice-countdown');
		await expect(countdown).toBeVisible();
		await expect(countdown).toContainText('Berlaku hingga');
		await expect(countdown).toContainText('/ sisa waktu');
		await expect(page.locator('.invoice-expired')).toHaveCount(0);
		await expect(page.locator('.invoice-valid-until')).toBeHidden();
		await expect(page.locator('header.print-hide')).toBeVisible();
		const chip = await countdown.evaluate((el) => {
			const style = getComputedStyle(el);
			return { bg: style.backgroundColor, color: style.color, font: style.fontFamily };
		});
		expect(chip.bg).toBe('rgb(229, 255, 0)');
		expect(chip.color).toBe('rgb(13, 1, 255)');
		expect(chip.font.toLowerCase()).toContain('urbanist');

		await page.emulateMedia({ media: 'print' });
		await expect(countdown).toBeHidden();
		await expect(page.locator('.invoice-valid-until')).toBeVisible();
		await expect(page.locator('.invoice-valid-until')).toContainText('Berlaku hingga');
		await expect(page.locator('.invoice-valid-until')).not.toContainText('sisa waktu');
		await expect(page.locator('header.print-hide')).toBeHidden();
		await expect(page.getByRole('button', { name: 'Export PDF' })).toBeHidden();
		await page.emulateMedia({ media: 'screen' });

		await gotoReady(page, `/admin/leads/${nomor}`);
		await page.getByRole('button', { name: 'Duplikat invoice' }).click();
		await expect(page).toHaveURL(/\/admin\/leads\/LA-\d{8}-[A-Z2-9]{8}\/ubah\?dari=LA-/);
		const copyUrl = new URL(page.url());
		expect(copyUrl.searchParams.get('dari')).toBe(nomor);
		const copy = copyUrl.pathname.split('/').at(-2)!;
		expect(copy).not.toBe(nomor);
		await expect(page.getByText(`Invoice ini duplikat dari ${nomor}`)).toBeVisible();
		await expect(page.getByLabel('Nama klien')).toHaveValue('Raka Duplikat');
		await expect(page.getByLabel('Include')).toHaveValue('Pemandu hutan\nMakan siang');
		await expect(page.getByLabel('Judul baris')).toHaveValue('Fee Services');
		await expect(page.getByLabel('Nominal DP')).toHaveValue('200000');
		await expect(page.getByText('Belum diatur.')).toBeVisible();

		await gotoReady(page, `/invoice/${copy}`);
		const copySheet = page.locator('.invoice-sheet');
		await expect(copySheet.getByRole('heading', { level: 1 })).toHaveText('Invoice Estimasi');
		await expect(copySheet.getByText('Pemandu hutan')).toBeVisible();
		await expect(copySheet.getByText('Fee Services')).toBeVisible();
		await expect(copySheet.getByText('Rp 493.900')).toBeVisible();
		await expect(copySheet.getByText('Rp 200.000')).toBeVisible();
		await expect(page.locator('.invoice-countdown')).toHaveCount(0);
		await expect(page.locator('.invoice-valid-until')).toHaveCount(0);
		await expect(copySheet.getByText('860025788700', { exact: true })).toBeVisible();

		await gotoReady(page, `/invoice/${nomor}`);
		await expect(page.locator('.invoice-countdown')).toBeVisible();

		await gotoReady(page, `/admin/leads/${nomor}`);
		await page.getByRole('button', { name: 'Tandai lunas' }).click();
		await expect(page.getByText('Invoice ditandai lunas.')).toBeVisible();
		await gotoReady(page, `/invoice/${nomor}`);
		await expect(page.locator('.invoice-sheet').getByRole('heading', { level: 1 })).toHaveText('Invoice Lunas');
		await expect(page.locator('.invoice-stamp')).toHaveText('LUNAS');
		await expect(page.locator('.invoice-countdown')).toHaveCount(0);
		await expect(page.locator('.invoice-expired')).toHaveCount(0);
		await expect(page.locator('.invoice-valid-until')).toHaveCount(0);

		await gotoReady(page, `/admin/leads/${copy}/ubah`);
		await page.getByRole('group', { name: 'Masa berlaku' }).getByLabel('Jam').check();
		await page.getByLabel('Jumlah jam').fill('2');
		await page.getByRole('button', { name: 'Terapkan' }).click();
		await expect(page.getByText('Masa berlaku disimpan.')).toBeVisible();
		exec('UPDATE lead SET berlaku_hingga = ? WHERE nomor_invoice = ?', '2020-01-01T00:00:00.000Z', copy);

		await gotoReady(page, `/invoice/${copy}`);
		const expired = page.locator('.invoice-expired');
		await expect(expired).toBeVisible();
		await expect(expired).toHaveText('Invoice kedaluwarsa, hubungi kami via WhatsApp');
		await expect(expired.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/6282120209900/);
		await expect(page.locator('.invoice-countdown')).toHaveCount(0);
		await page.emulateMedia({ media: 'print' });
		await expect(expired).toBeHidden();
		await expect(page.locator('.invoice-valid-until')).toBeVisible();
		await expect(page.locator('.invoice-valid-until')).toContainText('Berlaku hingga');
		await expect(page.locator('.invoice-valid-until')).not.toContainText('sisa waktu');
	});
});
