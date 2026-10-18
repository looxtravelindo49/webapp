import { calc } from '../support/calculator';
import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[trip-calculator] Section Konsultasikan Tripmu', () => {
	test('keadaan awal: ajakan memilih paket dan tidak ada angka total', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await expect(c.root).toContainText('Konsultasikan');
		await expect(c.root).toContainText('Tripmu.');
		await expect(c.root).toContainText('Pilih minimal satu paket');
		await expect(c.root).not.toContainText('Total estimasi');
	});
});

test.describe('[trip-calculator] Daftar paket di kalkulator', () => {
	test('lima paket berurutan dengan harga, "Harga menyusul", dan minimal peserta', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await expect(c.root.getByRole('checkbox')).toHaveCount(5);
		await expect(c.box('Offroad')).toBeVisible();
		await expect(c.root).toContainText('Rp 250.000 / orang');
		await expect(c.root).toContainText('Minimal 10 peserta');
		await expect(c.root).toContainText('Harga menyusul');
	});

	test('tidak ada isian Tujuan atau Anggaran; isian yang ada berlabel', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await expect(c.root.getByText(/Tujuan|Anggaran/)).toHaveCount(0);
		for (const t of [c.team, c.pax, c.date, c.notes]) await expect(t).toBeVisible();
		await expect(c.team).toHaveAttribute('maxlength', '100');
		await expect(c.notes).toHaveAttribute('maxlength', '1500');
	});
});

test.describe('[trip-calculator] Pilihan paket dibagi antara tab Paket dan kalkulator', () => {
	test('tambah dari tab: tombol, checkbox, penanda tab, tab tetap aktif, tanpa gulir', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.tab('Rafting').click();
		const y0 = await page.evaluate(() => scrollY);
		await expect(c.panelToggle).toHaveText('Tambah ke trip');
		await expect(c.panelToggle).toHaveAttribute('aria-pressed', 'false');
		await c.panelToggle.click();
		await expect(c.panelToggle).toHaveText('Hapus dari trip');
		await expect(c.panelToggle).toHaveAttribute('aria-pressed', 'true');
		await expect(c.box('Rafting')).toBeChecked();
		await expect(c.tab('Rafting')).toHaveAttribute('aria-selected', 'true');
		await expect(c.tab('Rafting')).toContainText('(dipilih)');
		await expect(c.tab('Rafting')).toContainText('✓');
		await expect(c.tab('Offroad')).not.toContainText('(dipilih)');
		expect(await page.evaluate(() => scrollY)).toBe(y0);
	});

	test('tambah dari kalkulator: tombol di panel ikut berubah', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Paintball').check();
		await c.tab('Paintball').click();
		await expect(c.panelToggle).toHaveAttribute('aria-pressed', 'true');
		await expect(c.panelToggle).toHaveText('Hapus dari trip');
		await expect(c.tab('Paintball')).toContainText('(dipilih)');
	});

	test('hapus pilihan dari kalkulator dan dari panel', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.tab('Rafting').click();
		await c.panelToggle.click();
		await expect(c.box('Rafting')).toBeChecked();
		await c.box('Rafting').uncheck();
		await expect(c.panelToggle).toHaveText('Tambah ke trip');
		await expect(c.tab('Rafting')).not.toContainText('(dipilih)');
		await c.panelToggle.click();
		await c.panelToggle.click();
		await expect(c.box('Rafting')).not.toBeChecked();
		await expect(c.root).toContainText('Pilih minimal satu paket');
	});

	test('beberapa paket terpilih ditandai di tabnya masing-masing', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await c.box('Rafting').check();
		await expect(c.tab('Offroad')).toContainText('(dipilih)');
		await expect(c.tab('Rafting')).toContainText('(dipilih)');
		for (const n of ['Team Building', 'Paintball', 'Fun Games']) await expect(c.tab(n)).not.toContainText('(dipilih)');
	});
});

test.describe('[trip-calculator] Perhitungan estimasi', () => {
	test('satu paket: Offroad × 40 = Rp 10.000.000', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await c.pax.fill('40');
		await expect(c.root).toContainText('40 × Rp 250.000');
		await expect(c.summary).toContainText('Rp 10.000.000');
	});

	test('beberapa paket dijumlahkan dan berubah langsung saat peserta diubah', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await c.box('Paintball').check();
		await c.pax.fill('40');
		await expect(c.root).toContainText('Rp 10.000.000');
		await expect(c.root).toContainText('Rp 6.000.000');
		await expect(c.summary).toContainText('Rp 16.000.000');
		await c.pax.fill('50');
		await expect(c.summary).toContainText('Rp 20.000.000');
	});

	test('minimal peserta ditagihkan dan dijelaskan', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Rafting').check();
		await c.pax.fill('4');
		await expect(c.root).toContainText('10 × Rp 200.000');
		await expect(c.root).toContainText('ditagihkan minimal 10 peserta');
		await expect(c.summary).toContainText('Rp 2.000.000');
	});

	test('Offroad + Rafting × 4 (minimal 10 untuk Rafting) = Rp 3.000.000', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await c.box('Rafting').check();
		await c.pax.fill('4');
		await expect(c.summary).toContainText('Rp 3.000.000');
	});

	test('sebagian paket tanpa harga: "Harga menyusul", total tanpa itu, dan catatan', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await c.box('Fun Games').check();
		await c.pax.fill('40');
		await expect(c.root.locator('li', { hasText: 'Fun Games' })).toContainText('Harga menyusul');
		await expect(c.summary).toContainText('Rp 10.000.000');
		await expect(c.summary).toContainText('belum termasuk paket tanpa harga');
	});

	test('semua paket tanpa harga: "Dibahas via WhatsApp"', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Fun Games').check();
		await c.pax.fill('40');
		await expect(c.summary).toContainText('Dibahas via WhatsApp');
		await expect(c.summary).not.toContainText('Rp');
	});
});

test.describe('[trip-calculator] Masukan formulir', () => {
	for (const bad of ['0', '-3', '2.5', '10001', 'abc']) {
		test(`jumlah peserta "${bad}": pesan kesalahan, tanpa total, terhubung via aria-describedby`, async ({ page }) => {
			await gotoReady(page, '/');
			const c = calc(page);
			await c.box('Offroad').check();
			await c.pax.fill(bad);
			await expect(c.pax).toHaveAttribute('aria-invalid', 'true');
			const describedBy = await c.pax.getAttribute('aria-describedby');
			expect(describedBy).toBeTruthy();
			await expect(page.locator(`#${describedBy}`)).toHaveText('Masukkan bilangan bulat 1 sampai 10.000.');
			await expect(c.root).toContainText('Isi jumlah peserta');
			await expect(c.root).not.toContainText('Total estimasi');
		});
	}

	test('batas 1 dan 10000 diterima', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await c.pax.fill('1');
		await expect(c.summary).toContainText('Rp 250.000');
		await c.pax.fill('10000');
		await expect(c.summary).toContainText('Rp 2.500.000.000');
		await expect(c.pax).not.toHaveAttribute('aria-invalid', 'true');
	});

	test('peserta kosong: "Isi jumlah peserta" tanpa pesan kesalahan', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await expect(c.root).toContainText('Isi jumlah peserta');
		await expect(c.pax).not.toHaveAttribute('aria-invalid', 'true');
		await expect(c.root).not.toContainText('Masukkan bilangan bulat');
	});
});

test.describe('[trip-calculator] Ringkasan estimasi', () => {
	test('total berada di wilayah aria-live polite', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await expect(c.summary).toHaveAttribute('aria-live', 'polite');
		await expect(c.summary).toHaveAttribute('aria-atomic', 'true');
	});
});

test.describe('[trip-calculator] Aksi hanya tersedia bila masukan valid', () => {
	test('petunjuk menyebut semua yang kurang dan kedua tombol dinonaktifkan', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await expect(c.save).toBeDisabled();
		await expect(c.send).toBeDisabled();
		await expect(c.hint).toHaveText('Lengkapi dulu: nama tim, minimal satu paket, jumlah peserta yang valid.');
	});

	test('tanpa nama tim: petunjuk menyebut nama tim; setelah diisi tombol aktif', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await c.pax.fill('40');
		await expect(c.hint).toHaveText('Lengkapi dulu: nama tim.');
		await expect(c.save).toBeDisabled();
		await c.team.fill('Tim Alfa');
		await expect(c.save).toBeEnabled();
		await expect(c.send).toBeEnabled();
		await expect(c.hint).toContainText('bukan penawaran final');
	});

	test('nama tim hanya spasi dianggap kosong', async ({ page }) => {
		await gotoReady(page, '/');
		const c = calc(page);
		await c.box('Offroad').check();
		await c.pax.fill('40');
		await c.team.fill('   ');
		await expect(c.save).toBeDisabled();
	});
});
