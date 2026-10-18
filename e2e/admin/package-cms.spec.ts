import type { Page } from '@playwright/test';
import { adminLogin, alerts, noClientValidation, path } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { fillPackage, insertPackage, pkgById, pkgByTitle, uniqueTitle, type FormValues } from '../support/cms';
import { query, scalar } from '../support/db';
import { expect, gotoReady, submit, test } from '../support/fixtures';

// Semua tes di file ini hanya membuat/mengubah/menghapus paket DRAFT buatan sendiri (awalan "Tes CMS"):
// paket terbit, urutan, dan harga bersama dipakai tes publik yang berjalan paralel. Tes yang menerbitkan
// atau mengubah urutan ada di e2e/mutating/cms.spec.ts. Tidak ada unggahan foto di sini (lihat image-uploads.spec.ts).
// Tidak ada pembersihan di file ini: dengan fullyParallel, afterAll berjalan per worker dan akan menghapus
// paket milik tes yang masih berjalan di worker lain. Sisa paket draft dibersihkan oleh e2e/mutating/cms.spec.ts.
const PW = 'sandi-admin-cms-1';
const PREFIX = 'Tes CMS';
let admin = '';

test.beforeAll(() => {
	admin = uniqueLogin('cms');
	insertAdmin(admin, PW);
});

const rowOf = (page: Page, slug: string) => page.locator(`li[data-package="${slug}"]`);
const slugOf = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const loggedIn = new WeakSet<Page>();
async function openNew(page: Page) {
	if (!loggedIn.has(page)) await adminLogin(page, admin, PW);
	loggedIn.add(page);
	await gotoReady(page, '/admin/paket/baru');
	await noClientValidation(page);
	// maxlength membuat peramban memotong ketikan; lepas agar batas panjang di server bisa diuji.
	await page.evaluate(() => document.querySelectorAll('[maxlength]').forEach((e) => e.removeAttribute('maxlength')));
}
/** Isi form tambah dan kirim; mengembalikan respons POST. */
async function create(page: Page, values: FormValues) {
	await openNew(page);
	await fillPackage(page, { summary: 'Ringkasan uji.', ...values });
	return submit(page, () => page.getByRole('button', { name: 'Simpan sebagai draft' }).click());
}

test.describe('[package-cms] Daftar paket di admin', () => {
	test('menampilkan semua paket (termasuk draft) dengan status, harga, dan minimal peserta', async ({ page }) => {
		const draft = uniqueTitle(`${PREFIX} Daftar`);
		insertPackage(draft, { price_per_person: 175_000, min_pax: 5 });
		const noPrice = uniqueTitle(`${PREFIX} TanpaHarga`);
		insertPackage(noPrice);
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');

		await expect(rowOf(page, slugOf(draft))).toContainText('Draft');
		await expect(rowOf(page, slugOf(draft))).toContainText('Rp 175.000 / orang');
		await expect(rowOf(page, slugOf(draft))).toContainText('min. 5 peserta');
		await expect(rowOf(page, slugOf(noPrice))).toContainText('Harga menyusul');
		await expect(rowOf(page, 'offroad')).toContainText('Terbit');
		await expect(rowOf(page, 'offroad')).toContainText('Rp 250.000 / orang');
		await expect(rowOf(page, 'team-building')).toContainText('Harga menyusul');
		await expect(rowOf(page, 'rafting')).toContainText('min. 10 peserta');
	});

	test('Naik dinonaktifkan pada paket pertama dan Turun pada paket terakhir', async ({ page }) => {
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		const rows = page.locator('li[data-package]');
		await expect(rows.first().getByRole('button', { name: /^Naik/ })).toBeDisabled();
		await expect(rows.first().getByRole('button', { name: /^Turun/ })).toBeEnabled();
		await expect(rows.last().getByRole('button', { name: /^Turun/ })).toBeDisabled();
		await expect(rows.last().getByRole('button', { name: /^Naik/ })).toBeEnabled();
	});

	test('tautan Tambah paket dan Ubah mengarah ke halaman yang benar', async ({ page }) => {
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		await expect(page.getByRole('link', { name: 'Tambah paket' })).toHaveAttribute('href', '/admin/paket/baru');
		const id = scalar<number>("SELECT id FROM package WHERE slug = 'offroad'");
		await expect(rowOf(page, 'offroad').getByRole('link', { name: 'Ubah' })).toHaveAttribute('href', `/admin/paket/${id}`);
	});
});

test.describe('[package-cms] Tambah paket', () => {
	test('paket baru: draft, di urutan terakhir, slug otomatis, tidak tampil di situs publik', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Flying Fox`);
		await create(page, { title, summary: 'Meluncur di atas hutan pinus.' });
		const row = pkgByTitle(title);
		expect(row).toMatchObject({ slug: slugOf(title), published: 0, price_per_person: null, min_pax: 1, image: null });
		// di belakang kelima paket bawaan (tes lain membuat draft secara paralel, jadi angka pastinya tidak dibandingkan)
		expect(row.sort_order).toBeGreaterThan(scalar<number>("SELECT MAX(sort_order) FROM package WHERE slug IN ('offroad','team-building','rafting','paintball','fun-games')"));
		// diarahkan ke halaman ubah dengan pemberitahuan
		expect(path(page)).toBe(`/admin/paket/${row.id}`);
		await expect(page.getByRole('status')).toContainText('draft');
		await expect(page.getByLabel('Nama paket', { exact: true })).toHaveValue(title);

		await gotoReady(page, '/');
		await expect(page.getByRole('tab', { name: title })).toHaveCount(0);
		await expect(page.getByText(title)).toHaveCount(0);
	});

	test('nama yang sama mendapat slug dengan sufiks -2', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Kembar`);
		insertPackage(title);
		await create(page, { title });
		const rows = query<{ slug: string }>('SELECT slug FROM package WHERE title = ? ORDER BY id', title);
		expect(rows.map((r) => r.slug)).toEqual([slugOf(title), `${slugOf(title)}-2`]);
	});

	test('slug hanya berisi a-z, 0-9, dan tanda hubung', async ({ page }) => {
		const tag = Date.now().toString(36);
		const title = `${PREFIX} Café & Ñandú 100%! ${tag}`;
		await create(page, { title });
		expect(pkgByTitle(title).slug).toBe(`tes-cms-cafe-nandu-100-${tag}`);
	});

	test('fasilitas: baris kosong dan spasi tepi dibuang', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Fasilitas`);
		await create(page, { title, includes: '  Jeep \n\n   Pemandu\r\n \nMakan siang  ' });
		expect(pkgByTitle(title).includes).toBe('Jeep\nPemandu\nMakan siang');
	});
});

test.describe('[package-cms] Validasi masukan paket', () => {
	test('nama kosong atau hanya spasi: pesan pada isian, terhubung, dan isian lain dipertahankan', async ({ page }) => {
		const marker = uniqueTitle(`${PREFIX} Ringkasan`);
		await create(page, { title: '   ', summary: marker, duration: '3 jam', price: '250.000', min_pax: '4' });
		expect(path(page)).toBe('/admin/paket/baru');
		expect(await alerts(page)).toEqual(['Nama paket wajib diisi.']);
		const title = page.getByLabel('Nama paket', { exact: true });
		await expect(title).toHaveAttribute('aria-invalid', 'true');
		const describedBy = await title.getAttribute('aria-describedby');
		expect(await page.locator(`[id="${describedBy}"]`).innerText()).toBe('Nama paket wajib diisi.');
		// isian lain tetap berisi apa yang diketik
		await expect(page.getByLabel('Ringkasan', { exact: true })).toHaveValue(marker);
		await expect(page.getByLabel(/^Durasi/)).toHaveValue('3 jam');
		await expect(page.getByLabel(/^Harga per orang/)).toHaveValue('250.000');
		await expect(page.getByLabel('Minimal peserta')).toHaveValue('4');
		expect(query('SELECT 1 FROM package WHERE summary = ?', marker)).toHaveLength(0);
	});

	test('ringkasan wajib; teks terlalu panjang menyebut batasnya dan data tidak berubah', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Panjang`);
		await create(page, { title, summary: 'x'.repeat(301) });
		expect(await alerts(page)).toEqual(['Ringkasan maksimal 300 karakter.']);
		await fillPackage(page, { summary: '   ' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan sebagai draft' }).click());
		expect(await alerts(page)).toEqual(['Ringkasan wajib diisi.']);
		expect(pkgByTitle(title)).toBeUndefined();
	});

	for (const bad of ['0', '-2', '2.5', '10001', 'abc']) {
		test(`minimal peserta "${bad}" ditolak dengan pesan pada isian itu`, async ({ page }) => {
			const title = uniqueTitle(`${PREFIX} MinPax`);
			await create(page, { title, min_pax: bad });
			expect(await alerts(page)).toEqual(['Minimal peserta harus bilangan bulat 1 sampai 10.000.']);
			await expect(page.getByLabel('Minimal peserta')).toHaveValue(bad);
			expect(pkgByTitle(title)).toBeUndefined();
		});
	}

	test('minimal peserta dikosongkan → 1; batas atas 10000 diterima', async ({ page }) => {
		const a = uniqueTitle(`${PREFIX} KosongPax`);
		await create(page, { title: a, min_pax: '' });
		expect(pkgByTitle(a).min_pax).toBe(1);
		const b = uniqueTitle(`${PREFIX} BatasPax`);
		await create(page, { title: b, min_pax: '10000' });
		expect(pkgByTitle(b).min_pax).toBe(10000);
	});
});

test.describe('[package-cms] Format harga', () => {
	for (const [input, expected] of [
		['250000', 250000],
		['250.000', 250000],
		['Rp 250.000', 250000],
		['Rp250000', 250000],
		['0', 0],
		['100.000.000', 100_000_000],
		['', null]
	] as const) {
		test(`harga "${input}" tersimpan sebagai ${expected}`, async ({ page }) => {
			const title = uniqueTitle(`${PREFIX} Harga`);
			await create(page, { title, price: input });
			expect(pkgByTitle(title).price_per_person).toBe(expected);
		});
	}

	for (const bad of ['250.5', '250,5', '250rb', '2.5jt', '-1', '100000001']) {
		test(`harga "${bad}" ditolak (bukan disimpan sebagai angka lain) dan data tidak berubah`, async ({ page }) => {
			const title = uniqueTitle(`${PREFIX} HargaSalah`);
			await create(page, { title, price: bad });
			expect(await alerts(page)).toEqual(['Isi harga dengan angka bulat, mis. 250000 atau 250.000. Kosongkan bila harga belum ditentukan.']);
			await expect(page.getByLabel(/^Harga per orang/)).toHaveValue(bad);
			expect(pkgByTitle(title)).toBeUndefined();
		});
	}
});

test.describe('[package-cms] Ubah paket', () => {
	test('form terisi nilai tersimpan, termasuk harga dan minimal peserta', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Terisi`);
		insertPackage(title, { price_per_person: 175_000, min_pax: 5, summary: 'Ringkasan tersimpan.', image_alt: 'Alt tersimpan' });
		const id = pkgByTitle(title).id;
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/paket/${id}`);
		await expect(page.getByLabel('Nama paket', { exact: true })).toHaveValue(title);
		await expect(page.getByLabel('Ringkasan', { exact: true })).toHaveValue('Ringkasan tersimpan.');
		await expect(page.getByLabel(/^Harga per orang/)).toHaveValue('175000');
		await expect(page.getByLabel('Minimal peserta')).toHaveValue('5');
		await expect(page.getByLabel(/^Teks alternatif foto/)).toHaveValue('Alt tersimpan');
		await expect(page.getByLabel('Tampilkan di situs')).not.toBeChecked();
	});

	test('mengganti nama tidak mengubah slug; harga NULL tampil kosong dan tetap NULL saat disimpan', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Ganti Nama`);
		insertPackage(title);
		const before = pkgByTitle(title);
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/paket/${before.id}`);
		await noClientValidation(page);
		await expect(page.getByLabel(/^Harga per orang/)).toHaveValue('');
		const renamed = `${title} Baru`;
		await fillPackage(page, { title: renamed, summary: 'Ringkasan diperbarui.', duration: '2 jam', price: '99.000' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		await expect(page.getByRole('status')).toContainText('disimpan');
		const after = pkgById(before.id);
		expect(after).toMatchObject({ slug: before.slug, title: renamed, summary: 'Ringkasan diperbarui.', duration: '2 jam', price_per_person: 99000, published: 0 });
		await expect(page.getByLabel('Nama paket', { exact: true })).toHaveValue(renamed);
		await expect(page.getByText(`/#paket-${before.slug}`)).toBeVisible();
	});

	test('validasi gagal pada ubah: data tersimpan tidak berubah dan isian dipertahankan', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Gagal Ubah`);
		insertPackage(title, { price_per_person: 50_000 });
		const id = pkgByTitle(title).id;
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/paket/${id}`);
		await noClientValidation(page);
		await fillPackage(page, { title: '', summary: 'Tidak boleh tersimpan.', price: 'abc' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect((await alerts(page)).sort()).toEqual([
			'Isi harga dengan angka bulat, mis. 250000 atau 250.000. Kosongkan bila harga belum ditentukan.',
			'Nama paket wajib diisi.'
		]);
		await expect(page.getByLabel('Ringkasan', { exact: true })).toHaveValue('Tidak boleh tersimpan.');
		expect(pkgById(id)).toMatchObject({ title, price_per_person: 50000, summary: 'Ringkasan uji.' });
	});

	for (const bad of ['999999', 'abc', '0']) {
		test(`/admin/paket/${bad} → 404`, async ({ page }) => {
			await adminLogin(page, admin, PW);
			const res = await page.goto(`/admin/paket/${bad}`);
			expect(res?.status()).toBe(404);
		});
	}

	test('teks yang diketik sebelum hidrasi tidak hilang', async ({ page }) => {
		await adminLogin(page, admin, PW);
		await page.goto('/admin/paket/baru');
		await page.getByLabel('Ringkasan', { exact: true }).fill('diketik-sebelum-hidrasi');
		await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
		await expect(page.getByLabel('Ringkasan', { exact: true })).toHaveValue('diketik-sebelum-hidrasi');
	});
});

test.describe('[package-cms] Hapus paket', () => {
	const rowFor = (page: Page, title: string) => rowOf(page, slugOf(title));

	test('konfirmasi dibatalkan: tidak ada permintaan hapus dan paket tetap', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Batal`);
		insertPackage(title);
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		let deletes = 0;
		page.on('request', (r) => r.method() === 'POST' && r.url().includes('hapus') && deletes++);
		const messages: string[] = [];
		page.once('dialog', (d) => { messages.push(d.message()); void d.dismiss(); });
		await rowFor(page, title).getByRole('button', { name: 'Hapus', exact: true }).click();
		await expect.poll(() => messages.length).toBe(1);
		expect(messages[0]).toContain(title);
		await page.evaluate(() => 0);
		expect(deletes).toBe(0);
		expect(pkgByTitle(title)).toBeTruthy();
		await expect(rowFor(page, title)).toBeVisible();
	});

	test('dikonfirmasi: paket hilang dari daftar, database, dan situs publik', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Hapus`);
		insertPackage(title, { image: '/media/forest.svg' });
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		page.once('dialog', (d) => d.accept());
		await submit(page, () => rowFor(page, title).getByRole('button', { name: 'Hapus', exact: true }).click());
		await expect(page.getByRole('status')).toContainText('dihapus');
		await expect(rowFor(page, title)).toHaveCount(0);
		expect(pkgByTitle(title)).toBeUndefined();
		// berkas statis tetap dilayani
		expect((await page.request.get('/media/forest.svg')).status()).toBe(200);
	});

	test('hapus tanpa tanda konfirmasi ditolak di server dan paket tetap', async ({ page, baseURL }) => {
		const title = uniqueTitle(`${PREFIX} TanpaKonfirmasi`);
		insertPackage(title);
		const id = pkgByTitle(title).id;
		await adminLogin(page, admin, PW);
		const res = await page.request.post('/admin/paket?/hapus', { form: { id: String(id) }, headers: { origin: new URL(baseURL!).origin } });
		expect(await res.text()).toContain('Penghapusan perlu konfirmasi');
		expect(pkgById(id)).toBeTruthy();
	});

	test('klik Hapus sebelum hidrasi tidak menghapus', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Prehidrasi`);
		insertPackage(title);
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/paket');
		await page.evaluate((slug) => {
			const form = document.querySelector(`li[data-package="${slug}"] form[action="?/hapus"]`) as HTMLFormElement;
			HTMLFormElement.prototype.submit.call(form); // melewati onsubmit, seperti klik sebelum JS terpasang
		}, slugOf(title));
		await expect(page.getByRole('alert').first()).toContainText('Penghapusan perlu konfirmasi');
		expect(pkgByTitle(title)).toBeTruthy();
	});

	test('hapus paket yang sudah tidak ada → "Paket tidak ditemukan."', async ({ page, baseURL }) => {
		await adminLogin(page, admin, PW);
		const res = await page.request.post('/admin/paket?/hapus', { form: { id: '987654', confirm: 'yes' }, headers: { origin: new URL(baseURL!).origin } });
		expect(await res.text()).toContain('Paket tidak ditemukan.');
	});
});

test.describe('[package-cms] Akses terbatas', () => {
	const pages = ['/admin/paket', '/admin/paket/baru', '/admin/paket/1', '/admin/pengaturan'];

	test('tanpa sesi: halaman dialihkan ke login', async ({ page }) => {
		for (const url of pages) {
			await gotoReady(page, url);
			expect(path(page), url).toBe('/admin/login');
		}
	});

	test('tanpa sesi: POST ke aksi dialihkan ke login dan tidak mengubah data', async ({ request, baseURL }) => {
		const title = uniqueTitle(`${PREFIX} TanpaSesi`);
		const row = insertPackage(title);
		const headers = { origin: new URL(baseURL!).origin };
		for (const action of ['terbit', 'naik', 'turun', 'hapus']) {
			const res = await request.post(`/admin/paket?/${action}`, { form: { id: String(row.id), confirm: 'yes' }, headers, maxRedirects: 0 });
			expect([200, 303], action).toContain(res.status());
			if (res.status() === 200) expect((await res.json()).type).toBe('redirect');
			else expect(res.headers().location).toBe('/admin/login');
		}
		const res = await request.post('/admin/paket/baru', { multipart: { title: 'Tes CMS Tanpa Sesi Dibuat', summary: 'x' }, headers, maxRedirects: 0 });
		expect([200, 303]).toContain(res.status());
		expect(pkgById(row.id)).toMatchObject({ published: 0 });
		expect(pkgByTitle('Tes CMS Tanpa Sesi Dibuat')).toBeUndefined();
	});

	test('akun yang wajib ganti password diarahkan ke halaman ganti password', async ({ page }) => {
		const login = uniqueLogin('cms-wajib');
		insertAdmin(login, PW, { mustChange: true });
		await adminLogin(page, login, PW);
		for (const url of pages) {
			await gotoReady(page, url);
			expect(path(page), url).toBe('/admin/ganti-password');
		}
	});
});
