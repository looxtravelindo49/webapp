import type { Page } from '@playwright/test';
import { adminLogin, alerts, noClientValidation } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { file, PNG } from '../support/assets';
import { calc, fillValid } from '../support/calculator';
import { cleanupPackages, fillPackage, insertPackage, pkgById, pkgByTitle, uniqueTitle } from '../support/cms';
import { exec, getSetting, query, scalar, setSetting } from '../support/db';
import { capturePopups, expect, gotoReady, stubShare, submit, test } from '../support/fixtures';

// Tes CMS yang memengaruhi data yang dibaca SEMUA halaman publik (terbit/urutan/harga/foto/nomor WhatsApp).
// Berada di proyek `mutating` (setelah proyek utama selesai), serial, dan memulihkan data di afterAll.
test.describe.configure({ mode: 'serial' });

const PW = 'sandi-admin-mutasi-1';
const PREFIXES = ['Tes CMS', 'Tes Foto', 'Tes Mutasi'];
const SEEDED = ['offroad', 'team-building', 'rafting', 'paintball', 'fun-games'];
const BASE_TABS = ['Offroad', 'Team Building', 'Rafting', 'Paintball', 'Fun Games'];

type Pkg = { slug: string; published: number; sort_order: number; price_per_person: number | null; min_pax: number };
let original: Pkg[] = [];
let originalWhatsapp = '';
let admin = '';

function restore() {
	for (const p of PREFIXES) cleanupPackages(p);
	for (const p of original) {
		exec('UPDATE package SET published = ?, sort_order = ?, price_per_person = ?, min_pax = ? WHERE slug = ?', p.published, p.sort_order, p.price_per_person, p.min_pax, p.slug);
	}
	setSetting('whatsapp', originalWhatsapp);
}

test.beforeAll(() => {
	// Proyek utama sudah selesai: buang sisa paket draft buatan tes agar urutan dan hitungan deterministik.
	for (const p of PREFIXES) cleanupPackages(p);
	original = query<Pkg>('SELECT slug, published, sort_order, price_per_person, min_pax FROM package');
	originalWhatsapp = getSetting('whatsapp')!;
	admin = uniqueLogin('mutasi');
	insertAdmin(admin, PW);
});
test.afterAll(restore);

const rowOf = (page: Page, slug: string) => page.locator(`li[data-package="${slug}"]`);
const tabs = async (page: Page) => (await page.locator('#paket h3').allInnerTexts()).map((t) => t.trim());
const dbOrder = () => query<{ slug: string; sort_order: number }>('SELECT slug, sort_order FROM package ORDER BY sort_order, id');
/** Urutan paket bawaan saja (paket buatan tes lain berada di sela-selanya). */
const seededOrder = () => dbOrder().map((r) => r.slug).filter((slug) => SEEDED.includes(slug));
const contiguous = () => dbOrder().map((r) => r.sort_order).every((n, i) => n === i + 1);
const click = (page: Page, slug: string, name: string) =>
	submit(page, () => rowOf(page, slug).getByRole('button', { name, exact: false }).click());

test.describe('[package-cms] Terbitkan dan sembunyikan', () => {
	test('menyembunyikan paket menghapus tab dan pilihan kalkulator; menerbitkan mengembalikannya', async ({ page }) => {
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		await expect(rowOf(page, 'rafting')).toContainText('Terbit');
		await click(page, 'rafting', 'Sembunyikan');
		await expect(page.getByRole('status')).toContainText('disembunyikan');
		await expect(rowOf(page, 'rafting')).toContainText('Draft');
		await expect(rowOf(page, 'rafting').getByRole('button', { name: 'Terbitkan' })).toBeVisible();

		await gotoReady(page, '/');
		expect(await tabs(page)).toEqual(['Offroad', 'Team Building', 'Paintball', 'Fun Games']);
		await expect(calc(page).root.getByRole('checkbox')).toHaveCount(4);
		await expect(calc(page).box('Rafting')).toHaveCount(0);

		await gotoReady(page, '/admin/paket');
		await click(page, 'rafting', 'Terbitkan');
		await expect(page.getByRole('status')).toContainText('diterbitkan');
		await gotoReady(page, '/');
		expect(await tabs(page)).toEqual(BASE_TABS);
		await expect(calc(page).root.getByRole('checkbox')).toHaveCount(5);
	});

	test('paket draft yang diterbitkan tampil sebagai tab dan pilihan kalkulator di urutannya', async ({ page }) => {
		const title = uniqueTitle('Tes Mutasi Terbit');
		const row = insertPackage(title, { price_per_person: 90_000 });
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/');
		await expect(page.locator('#paket h3', { hasText: title })).toHaveCount(0);
		await gotoReady(page, '/admin/paket');
		await click(page, row.slug, 'Terbitkan');
		await gotoReady(page, '/');
		expect(await tabs(page)).toEqual([...BASE_TABS, title]);
		await expect(calc(page).box(title)).toBeVisible();
		await gotoReady(page, '/admin/paket');
		await click(page, row.slug, 'Sembunyikan');
		await gotoReady(page, '/');
		expect(await tabs(page)).toEqual(BASE_TABS);
	});
});

test.describe('[package-cms] Urutan paket', () => {
	test('Naik dan Turun menukar tetangga, publik mengikuti, dan sort_order dirapatkan 1..n', async ({ page }) => {
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		await click(page, 'rafting', 'Naik');
		await expect(page.getByRole('status')).toContainText('Urutan paket diperbarui');
		expect(seededOrder()).toEqual(['offroad', 'rafting', 'team-building', 'paintball', 'fun-games']);
		expect(contiguous()).toBe(true);
		await gotoReady(page, '/');
		expect(await tabs(page)).toEqual(['Offroad', 'Rafting', 'Team Building', 'Paintball', 'Fun Games']);

		await gotoReady(page, '/admin/paket');
		await click(page, 'rafting', 'Turun');
		expect(seededOrder()).toEqual(SEEDED);
	});

	test('memindahkan Paintball ke posisi pertama: tab pertama di beranda adalah Paintball', async ({ page }) => {
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		for (let i = 0; i < 3; i++) await click(page, 'paintball', 'Naik');
		expect(seededOrder()[0]).toBe('paintball');
		expect(dbOrder()[0].slug).toBe('paintball');
		await gotoReady(page, '/');
		expect((await tabs(page))[0]).toBe('Paintball');
		await gotoReady(page, '/admin/paket');
		await expect(rowOf(page, 'paintball').getByRole('button', { name: /^Naik/ })).toBeDisabled();
	});

	test('sort_order yang tidak rapat dinormalkan menjadi 1..n pada pemindahan berikutnya', async ({ page }) => {
		exec("UPDATE package SET sort_order = id * 10 + 3 WHERE slug IN ('offroad','team-building','rafting','paintball','fun-games')");
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		await click(page, 'offroad', 'Turun');
		expect(contiguous()).toBe(true);
		expect(dbOrder().map((r) => r.sort_order)[0]).toBe(1);
	});

	test('Naik pada paket pertama dan Turun pada paket terakhir (permintaan langsung) tidak mengubah apa pun', async ({ page, baseURL }) => {
		for (const p of original) exec('UPDATE package SET sort_order = ? WHERE slug = ?', p.sort_order, p.slug);
		await adminLogin(page, admin, PW);
		const headers = { origin: new URL(baseURL!).origin };
		const before = dbOrder();
		const first = scalar<number>('SELECT id FROM package ORDER BY sort_order, id LIMIT 1');
		const last = scalar<number>('SELECT id FROM package ORDER BY sort_order DESC, id DESC LIMIT 1');
		const up = await page.request.post('/admin/paket?/naik', { form: { id: String(first) }, headers });
		expect(await up.text()).toContain('Urutan tidak berubah.');
		const down = await page.request.post('/admin/paket?/turun', { form: { id: String(last) }, headers });
		expect(await down.text()).toContain('Urutan tidak berubah.');
		expect(dbOrder()).toEqual(before);
		const missing = await page.request.post('/admin/paket?/naik', { form: { id: '987654' }, headers });
		expect(await missing.text()).toContain('Paket tidak ditemukan.');
	});
});

test.describe('[package-cms] Perubahan tampil langsung di situs publik', () => {
	test('harga baru dan minimal peserta baru dipakai kalkulator', async ({ page }) => {
		const title = uniqueTitle('Tes Mutasi Harga');
		const row = insertPackage(title, { published: 1 });
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/paket/${row.id}`);
		await noClientValidation(page);
		await fillPackage(page, { price: '175.000', min_pax: '8' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(pkgById(row.id)).toMatchObject({ price_per_person: 175000, min_pax: 8, published: 1 });

		await gotoReady(page, '/');
		const c = calc(page);
		await expect(c.root).toContainText('Rp 175.000 / orang');
		await expect(c.root).toContainText('Minimal 8 peserta');
		await fillValid(page, { packages: [title], pax: '20' });
		await expect(c.root).toContainText('20 × Rp 175.000');
		await expect(c.summary).toContainText('Rp 3.500.000');

		await c.pax.fill('4');
		await expect(c.root).toContainText('8 × Rp 175.000');
		await expect(c.root).toContainText('ditagihkan minimal 8 peserta');
		await expect(c.summary).toContainText('Rp 1.400.000');
	});

	test('ringkasan, fasilitas, foto, dan teks alternatif baru tampil di panel paket', async ({ page }) => {
		const title = uniqueTitle('Tes Mutasi Panel');
		const row = insertPackage(title, { published: 1, price_per_person: 120_000 });
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/paket/${row.id}`);
		await noClientValidation(page);
		await fillPackage(page, {
			summary: 'Ringkasan baru dari admin.',
			includes: 'Jeep terbuka\nPemandu',
			duration: '3 jam',
			image_alt: 'Jeep di hutan pinus'
		});
		await page.getByLabel(/^Unggah foto/).setInputFiles(file('jeep.png', PNG, 'image/png'));
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		const saved = pkgById(row.id);
		expect(saved.image).toMatch(/^\/uploads\/.+\.png$/);

		await gotoReady(page, '/');
		await page.locator('#paket').getByRole('button', { name: `Geser ke ${title}`, exact: true }).click();
		const panel = page.locator('#paket [aria-roledescription="slide"]:not([inert])');
		await expect(panel).toContainText('Ringkasan baru dari admin.');
		await expect(panel).toContainText('Jeep terbuka');
		await expect(panel).toContainText('Pemandu');
		await expect(panel).toContainText('3 jam');
		const img = panel.getByAltText('Jeep di hutan pinus');
		await expect(img).toHaveAttribute('src', saved.image!);
		await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

		// teks alternatif dikosongkan → nama paket
		await gotoReady(page, `/admin/paket/${row.id}`);
		await noClientValidation(page);
		await fillPackage(page, { image_alt: '' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(pkgById(row.id).image_alt).toBeNull();
		await gotoReady(page, '/');
		await page.locator('#paket').getByRole('button', { name: `Geser ke ${title}`, exact: true }).click();
		await expect(page.locator('#paket [aria-roledescription="slide"]:not([inert])').getByAltText(title, { exact: true })).toHaveAttribute('src', saved.image!);

		// hapus foto → gambar bawaan
		await gotoReady(page, `/admin/paket/${row.id}`);
		await page.getByLabel('Hapus foto ini').check();
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		await gotoReady(page, '/');
		await page.locator('#paket').getByRole('button', { name: `Geser ke ${title}`, exact: true }).click();
		await expect(page.locator('#paket [aria-roledescription="slide"]:not([inert])').getByAltText(title, { exact: true })).toHaveAttribute('src', '/media/forest.svg');
	});

	test('beranda admin memperingatkan jumlah paket terbit yang belum berharga', async ({ page }) => {
		const title = uniqueTitle('Tes Mutasi TanpaHarga');
		insertPackage(title, { published: 1 });
		const expected = scalar<number>('SELECT COUNT(*) FROM package WHERE published = 1 AND price_per_person IS NULL');
		expect(expected).toBeGreaterThanOrEqual(3); // Team Building, Fun Games, dan paket ini
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin');
		await expect(page.getByTestId('price-warning')).toContainText(`${expected} paket terbit belum berharga`);

		exec('UPDATE package SET price_per_person = 1000 WHERE published = 1 AND price_per_person IS NULL');
		await gotoReady(page, '/admin');
		await expect(page.getByTestId('price-warning')).toHaveCount(0);
	});

	test('Naik/Turun, Ubah, dan tautan beranda tampil sebagai navigasi admin', async ({ page }) => {
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin');
		for (const [name, href] of [['Paket', '/admin/paket'], ['Pengaturan', '/admin/pengaturan'], ['Akun', '/admin/akun']] as const) {
			await expect(page.getByRole('main').getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('href', href);
		}
	});
});

test.describe('[site-settings] Nomor WhatsApp dari admin', () => {
	async function save(page: Page, value: string) {
		await gotoReady(page, '/admin/pengaturan');
		await noClientValidation(page);
		await page.getByLabel('Nomor WhatsApp tujuan').fill(value);
		await submit(page, () => page.getByRole('button', { name: 'Simpan' }).click());
	}

	test.beforeEach(async ({ page }) => {
		setSetting('whatsapp', '6282120209900');
		await adminLogin(page, admin, PW);
	});

	test('format lokal dan internasional dinormalisasi; halaman menampilkan nilai tersimpan', async ({ page }) => {
		await save(page, '0812-3456-7890');
		expect(getSetting('whatsapp')).toBe('6281234567890');
		await expect(page.getByRole('status')).toContainText('6281234567890');
		await expect(page.getByLabel('Nomor WhatsApp tujuan')).toHaveValue('6281234567890');

		await save(page, '+62 812 3456 7891');
		expect(getSetting('whatsapp')).toBe('6281234567891');
	});

	for (const bad of ['12345', 'abc', '0812']) {
		test(`nomor tidak valid "${bad}": pesan, nilai lama tetap, isian dipertahankan`, async ({ page }) => {
			await save(page, bad);
			expect(await alerts(page)).toEqual(['Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890 atau +62 812 3456 7890.']);
			expect(getSetting('whatsapp')).toBe('6282120209900');
			await expect(page.getByLabel('Nomor WhatsApp tujuan')).toHaveValue(bad);
			const input = page.getByLabel('Nomor WhatsApp tujuan');
			expect(await input.getAttribute('aria-invalid')).toBe('true');
		});
	}

	test('nomor baru langsung dipakai tab wa.me di kalkulator publik', async ({ page, context }) => {
		await save(page, '0812-3456-7890');
		await stubShare(context, 'none');
		await capturePopups(context);
		await gotoReady(page, '/');
		const c = await fillValid(page);
		const popupP = context.waitForEvent('page');
		await c.send.click();
		const popup = await popupP;
		await expect.poll(() => popup.url()).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/);
	});

	test('dikosongkan: tersimpan kosong dan tombol WhatsApp hilang dari kalkulator', async ({ page }) => {
		await save(page, '   ');
		expect(getSetting('whatsapp')).toBe('');
		await expect(page.getByRole('status')).toContainText('dikosongkan');
		await gotoReady(page, '/');
		const c = await fillValid(page);
		await expect(c.send).toHaveCount(0);
		await expect(c.root.getByRole('button', { name: 'Simpan PDF' })).toHaveCount(0);
	});
});
