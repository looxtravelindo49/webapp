import { calc, fillValid } from '../support/calculator';
import { capturePopups, expect, gotoReady, readPdf, stubShare, test, type ShareMode } from '../support/fixtures';

const FILENAME = /^estimasi-trip-tim-alfa-\d{4}-\d{2}-\d{2}\.pdf$/;
type W = { __shared?: { n: number; type: string; name: string; size: number; text: string }; __shareCalls?: number };

test.describe('[estimate-sharing] PDF estimasi', () => {
	test('Simpan PDF mengunduh berkas %PDF dengan nama dan isi yang benar', async ({ page }) => {
		await gotoReady(page, '/');
		const c = await fillValid(page, { packages: ['Offroad', 'Rafting', 'Fun Games'], team: 'Tim Alfa', pax: '4' });
		await c.date.fill('2026-11-20');
		await c.notes.fill('Ada 2 peserta vegetarian.');
		const [download] = await Promise.all([page.waitForEvent('download'), c.save.click()]);
		expect(download.suggestedFilename()).toMatch(FILENAME);
		const pdf = await readPdf(download);
		expect(pdf.startsWith('%PDF')).toBe(true);
		for (const s of [
			'Tim Alfa', 'Estimasi Trip', 'Offroad', 'Rafting', 'Fun Games', 'Rp 250.000', 'Rp 1.000.000', 'Rp 2.000.000',
			'Rp 3.000.000', 'ditagihkan minimal 10 peserta', 'Harga menyusul', 'belum termasuk paket tanpa harga',
			'20 November 2026', 'Ada 2 peserta vegetarian.', 'bukan penawaran final', 'Lembang Adventures'
		]) {
			expect(pdf, `PDF memuat "${s}"`).toContain(s);
		}
		await expect(c.status).toHaveText('PDF tersimpan.');
	});

	test('status hasil direset saat masukan berubah', async ({ page }) => {
		await gotoReady(page, '/');
		const c = await fillValid(page);
		await Promise.all([page.waitForEvent('download'), c.save.click()]);
		await expect(c.status).toHaveText('PDF tersimpan.');
		await c.team.fill('Tim Beta');
		await expect(c.status).not.toContainText('PDF tersimpan.');
	});

	test('semua paket tanpa harga: PDF memuat "Dibahas via WhatsApp"', async ({ page }) => {
		await gotoReady(page, '/');
		const c = await fillValid(page, { packages: ['Fun Games'] });
		const [download] = await Promise.all([page.waitForEvent('download'), c.save.click()]);
		const pdf = await readPdf(download);
		expect(pdf).toContain('Dibahas via WhatsApp');
		expect(pdf).toContain('Harga menyusul');
	});

	test('teks di luar Latin-1 disaring (emoji → ?) dan nama berkas tetap aman', async ({ page }) => {
		await gotoReady(page, '/');
		const c = await fillValid(page, { team: 'Tim 😀 Alfa' });
		await c.notes.fill('“halo” – ok');
		const [download] = await Promise.all([page.waitForEvent('download'), c.save.click()]);
		expect(download.suggestedFilename()).toMatch(FILENAME);
		const pdf = await readPdf(download);
		expect(pdf).toContain('Tim ? Alfa');
		expect(pdf).toContain('"halo" - ok');
		expect(pdf).not.toContain('😀');
	});
});

test.describe('[estimate-sharing] Kirim ke WhatsApp lewat Web Share', () => {
	test('dibagikan: satu berkas application/pdf + teks pesan, tanpa unduhan atau tab baru', async ({ page, context }) => {
		await stubShare(context, 'share-ok');
		const popups = await capturePopups(context);
		let downloads = 0;
		page.on('download', () => downloads++);
		await gotoReady(page, '/');
		const c = await fillValid(page);
		await c.send.click();
		await expect(c.status).toHaveText('Dibagikan.');
		const shared = await page.evaluate(() => (window as unknown as W).__shared);
		expect(shared).toMatchObject({ n: 1, type: 'application/pdf' });
		expect(shared!.name).toMatch(FILENAME);
		expect(shared!.size).toBeGreaterThan(1000);
		expect(shared!.text).toContain('Nama tim: Tim Alfa');
		expect(shared!.text).toContain('- Offroad: 40 x Rp 250.000 = Rp 10.000.000');
		expect(shared!.text).toContain('Estimasi total: Rp 10.000.000');
		expect(downloads).toBe(0);
		expect(popups).toHaveLength(0);
	});

	test('dibatalkan (AbortError): diam, tanpa cadangan, tombol aktif lagi', async ({ page, context }) => {
		await stubShare(context, 'abort');
		const popups = await capturePopups(context);
		let downloads = 0;
		page.on('download', () => downloads++);
		await gotoReady(page, '/');
		const c = await fillValid(page);
		await c.send.click();
		await expect.poll(() => page.evaluate(() => (window as unknown as W).__shareCalls)).toBe(1);
		await expect(c.send).toContainText('Kirim ke WhatsApp');
		await expect(c.send).toBeEnabled();
		await expect(c.status).toHaveText('');
		expect(downloads).toBe(0);
		expect(popups).toHaveLength(0);
	});
});

test.describe('[estimate-sharing] Cadangan unduh dan wa.me', () => {
	const modes: [ShareMode, string][] = [
		['not-allowed', 'share ditolak (NotAllowedError)'],
		['none', 'tanpa Web Share API'],
		['cannot', 'canShare menyatakan tidak bisa']
	];
	for (const [mode, label] of modes) {
		test(`${label}: unduh PDF, buka wa.me dengan teks, tampilkan petunjuk dan tautan manual`, async ({ page, context }) => {
			await stubShare(context, mode);
			await gotoReady(page, '/');
			const c = await fillValid(page);
			const downloadP = page.waitForEvent('download');
			const popupP = context.waitForEvent('page');
			await c.send.click();

			const download = await downloadP;
			expect(download.suggestedFilename()).toMatch(FILENAME);
			expect((await readPdf(download)).startsWith('%PDF')).toBe(true);

			const popup = await popupP;
			await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/6282120209900\?text=/);
			const text = decodeURIComponent(popup.url().split('text=')[1]);
			expect(text).toContain('Halo Lembang Adventures, saya ingin konsultasi trip.');
			expect(text).toContain('Nama tim: Tim Alfa');
			expect(text).toContain('Estimasi total: Rp 10.000.000');
			expect(text).toContain('Mohon dibantu penawarannya');

			await expect(c.status).toContainText('PDF sudah diunduh. Lampirkan file itu di chat WhatsApp.');
			const manual = c.root.getByRole('link', { name: /Buka WhatsApp/ });
			await expect(manual).toHaveAttribute('target', '_blank');
			await expect(manual).toHaveAttribute('rel', 'noopener noreferrer');
			expect(decodeURIComponent((await manual.getAttribute('href'))!)).toBe(decodeURIComponent(popup.url()));
		});
	}

	test('tab diblokir: tautan manual "Buka WhatsApp" tetap tersedia', async ({ page, context }) => {
		await stubShare(context, 'none');
		// window.open dibuat gagal seperti saat pop-up diblokir peramban
		await context.addInitScript(() => { window.open = () => null; });
		await gotoReady(page, '/');
		const c = await fillValid(page);
		const downloadP = page.waitForEvent('download');
		await c.send.click();
		await downloadP;
		await expect(c.root.getByRole('link', { name: /Buka WhatsApp/ })).toHaveAttribute('href', /^https:\/\/wa\.me\/6282120209900\?text=/);
	});
});

test.describe('[estimate-sharing] Pemrosesan hanya di browser', () => {
	test('mengisi formulir dan menyimpan PDF tidak mengirim isi formulir ke server', async ({ page }) => {
		await gotoReady(page, '/');
		const sent: { method: string; url: string; body: string | null }[] = [];
		page.on('request', (r) => sent.push({ method: r.method(), url: r.url(), body: r.postData() }));
		const c = calc(page);
		await c.box('Offroad').check();
		await c.team.fill('RAHASIA-TIM-XYZ');
		await c.notes.fill('CATATAN-RAHASIA-123');
		await c.pax.fill('40');
		await Promise.all([page.waitForEvent('download'), c.save.click()]);
		expect(sent.filter((r) => r.method !== 'GET')).toEqual([]);
		expect(sent.some((r) => /RAHASIA|CATATAN/.test(r.url) || /RAHASIA|CATATAN/.test(r.body ?? ''))).toBe(false);
	});
});
