import { fillValid } from '../support/calculator';
import { query } from '../support/db';
import { adminLogin } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { capturePopups, expect, gotoReady, test } from '../support/fixtures';

function waText(url: string) {
	return decodeURIComponent(url.split('text=')[1] ?? '');
}

test.describe('[estimate-sharing] Kirim ke WhatsApp membuat invoice', () => {
	test('satu klik menyimpan lead, membuka invoice, dan wa.me tanpa PDF', async ({ page, context }) => {
		await gotoReady(page, '/');
		const c = await fillValid(page, { packages: ['Offroad', 'Rafting'], team: 'Tim Alfa', pax: '40' });
		await c.date.fill('2026-11-20');
		await c.notes.fill('Ada 2 peserta vegetarian.');
		const popupP = context.waitForEvent('page');
		await c.send.click();

		await expect(page).toHaveURL(/\/invoice\/LA-\d{8}-[A-Z2-9]{8}$/);
		const popup = await popupP;
		await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/6282120209900\?text=/);
		const text = waText(popup.url());
		expect(text).toContain('Paket: Offroad, Rafting');
		expect(text).toContain('Jumlah peserta: 40 orang');
		expect(text).toContain('20 November 2026');
		expect(text).toContain('Estimasi: Rp 18.000.000');
		expect(text).toContain('Ada 2 peserta vegetarian.');
		expect(text).toContain(new URL(page.url()).pathname);
		expect(text.toLowerCase()).not.toContain('pdf');
		expect(text.toLowerCase()).not.toContain('lampir');

		const sheet = page.locator('.invoice-sheet');
		await expect(sheet.getByRole('heading', { level: 1 })).toHaveText('Invoice Estimasi');
		const fresh = await page.request.get(page.url());
		expect(fresh.headers()['cache-control'] ?? '').toContain('no-store');
		await expect(sheet.getByText('Baru', { exact: true })).toBeVisible();
		await expect(sheet.getByText('Transfer ke rekening PT: CIMB Niaga Syariah 860025788700 a/n Loox Travel Luxury.')).toBeVisible();
		await expect(sheet.getByRole('link', { name: /Kirim bukti transfer/ })).toHaveAttribute('href', /wa\.me\/6282120209900\?text=/);
		await expect(sheet.getByText('DP 30% dibayar maksimal 2x24 jam setelah invoice terbit. Pelunasan maksimal H-3 sebelum acara.')).toBeVisible();
		await expect(sheet.getByRole('link', { name: 'Kebijakan pembayaran' })).toHaveAttribute('href', '/kebijakan-pembayaran');
		await expect(sheet.getByRole('button', { name: 'Bayar DP 30% (segera)' })).toBeDisabled();
		await expect(sheet.getByText('860025788700', { exact: true })).toBeVisible();
		await expect(sheet.getByText('a/n Loox Travel Luxury', { exact: true })).toBeVisible();
		await expect(sheet.getByText('Hati-hati memilih travel. Pastikan travel sudah berbadan hukum PT')).toBeVisible();
		await expect(sheet.getByText('Rp 5.400.000')).toBeVisible();
		await expect(sheet.getByText(/biaya layanan|biaya admin/i)).toHaveCount(0);

		const nomor = new URL(page.url()).pathname.split('/').pop()!;
		const proofHref = await sheet.getByRole('link', { name: /Kirim bukti transfer/ }).getAttribute('href');
		expect(decodeURIComponent(proofHref ?? '')).toContain(`Nomor invoice: ${nomor}`);
		expect(decodeURIComponent(proofHref ?? '').toLowerCase()).not.toContain('pdf');
		const rows = query<{ nama: string; estimasi_total: number; dp_nominal: number }>('SELECT nama, estimasi_total, dp_nominal FROM lead WHERE nomor_invoice = ?', nomor);
		expect(rows).toHaveLength(1);
		expect(rows[0].nama).toBe('Tim Alfa');
		expect(rows[0].estimasi_total).toBe(18_000_000);
		expect(rows[0].dp_nominal).toBe(5_400_000);

		await page.reload();
		await expect(page.getByText(nomor, { exact: true })).toBeVisible();
		expect(query('SELECT nomor_invoice FROM lead WHERE nama = ?', 'Tim Alfa').length).toBe(1);
	});

	test('popup diblokir: lead tetap tersimpan dan invoice punya tautan WhatsApp', async ({ page, context }) => {
		await context.addInitScript(() => {
			window.open = () => null;
		});
		const popups = await capturePopups(context);
		await gotoReady(page, '/');
		const c = await fillValid(page, { team: 'Tim Popup' });
		await c.send.click();
		await expect(page).toHaveURL(/\/invoice\/LA-/);
		await expect(page.getByRole('link', { name: /Konfirmasi via WhatsApp/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/6282120209900\?text=/);
		expect(popups).toHaveLength(0);
		expect(query('SELECT id FROM lead WHERE nama = ?', 'Tim Popup')).toHaveLength(1);
	});

	test('semua paket tanpa harga: invoice tanpa nominal DP karangan', async ({ page, context }) => {
		const popups = await capturePopups(context);
		await gotoReady(page, '/');
		const c = await fillValid(page, { packages: ['Fun Games'], team: 'Tim Nol', pax: '8' });
		await c.send.click();
		await expect(page).toHaveURL(/\/invoice\/LA-/);
		await expect(page.getByText('Dibahas via WhatsApp')).toBeVisible();
		await expect(page.getByText('Nominal DP 30% muncul setelah estimasinya berupa angka.')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Bayar DP 30% (segera)' })).toBeDisabled();
		const nomor = new URL(page.url()).pathname.split('/').pop()!;
		const rows = query<{ estimasi_total: number | null; dp_nominal: number | null }>('SELECT estimasi_total, dp_nominal FROM lead WHERE nomor_invoice = ?', nomor);
		expect(rows[0].estimasi_total).toBeNull();
		expect(rows[0].dp_nominal).toBeNull();
		expect(popups.length).toBeGreaterThan(0);
	});

	test('lead tampil di admin', async ({ page }) => {
		await gotoReady(page, '/');
		const c = await fillValid(page, { team: 'Tim Admin Lead', pax: '4' });
		await c.send.click();
		await expect(page).toHaveURL(/\/invoice\/LA-/);
		const nomor = new URL(page.url()).pathname.split('/').pop()!;

		const login = uniqueLogin('leads');
		insertAdmin(login, 'sandi-uji-leads-1');
		await adminLogin(page, login, 'sandi-uji-leads-1');
		await gotoReady(page, '/admin/leads');
		await expect(page.getByText('Tim Admin Lead')).toBeVisible();
		await expect(page.getByText(nomor)).toBeVisible();
		await page.getByRole('link', { name: nomor }).click();
		await expect(page.getByRole('link', { name: /Buka invoice/ })).toBeVisible();
		await expect(page.getByText('+6281234567890')).toBeVisible();
		await page.getByLabel('Jumlah diterima (opsional)').fill('1500000');
		await page.getByLabel('Tanggal diterima').fill('2026-10-20');
		await page.getByRole('button', { name: 'Konfirmasi DP diterima' }).click();
		await expect(page.getByText('DP dicatat. Invoice publik sekarang bertanda DP diterima.')).toBeVisible();
		await expect(page.getByText('DP diterima · 20 Oktober 2026')).toBeVisible();
		await expect(page.getByText('Rp 1.500.000')).toBeVisible();

		await gotoReady(page, `/invoice/${nomor}`);
		const paid = page.locator('.invoice-sheet');
		await expect(paid.getByRole('heading', { level: 1 })).toHaveText('Invoice');
		await expect(paid.locator('.rounded-full', { hasText: 'DP diterima' })).toBeVisible();
		await expect(paid.getByText('Diterima 20 Oktober 2026')).toBeVisible();
		await expect(paid.getByText('Rp 1.500.000')).toBeVisible();
		await expect(paid.getByText('Sisa tagihan', { exact: true })).toBeVisible();
		await expect(paid.getByText('Cara bayar sekarang')).toHaveCount(0);
		await expect(paid.getByRole('button', { name: 'Bayar DP 30% (segera)' })).toHaveCount(0);

		await gotoReady(page, '/admin/leads?status=dp_diterima');
		await expect(page.getByText('Tim Admin Lead')).toBeVisible();
		await gotoReady(page, '/admin/leads?status=batal');
		await expect(page.getByText('Tim Admin Lead')).toHaveCount(0);

		await gotoReady(page, `/admin/leads/${nomor}`);
		await page.getByRole('button', { name: 'Tandai lunas' }).click();
		await expect(page.getByText('Invoice ditandai lunas.')).toBeVisible();
		await gotoReady(page, `/invoice/${nomor}`);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Invoice Lunas');
		await expect(page.getByText('LUNAS', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Bayar DP 30% (segera)' })).toHaveCount(0);
		await gotoReady(page, `/admin/leads/${nomor}`);
		page.once('dialog', (dialog) => dialog.accept());
		await page.getByRole('button', { name: 'Batalkan' }).click();
		await expect(page.getByText('Invoice dibatalkan.')).toBeVisible();
		await expect(page.getByText('Batal', { exact: true })).toBeVisible();
		await expect(page.getByText('Rp 1.500.000')).toBeVisible();
		await gotoReady(page, `/invoice/${nomor}`);
		const cancelled = page.locator('.invoice-sheet');
		await expect(cancelled.getByRole('heading', { level: 1 })).toHaveText('Invoice');
		await expect(cancelled.getByText('Dibatalkan', { exact: true })).toBeVisible();
		await expect(cancelled.getByRole('button', { name: 'Bayar DP 30% (segera)' })).toHaveCount(0);
	});
});
