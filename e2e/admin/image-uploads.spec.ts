import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { adminLogin, alerts, noClientValidation } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { AVIF, file, GIF, JPEG, MB, PNG, pngOfSize, SVG, TEXT, WEBP } from '../support/assets';
import { fillPackage, insertPackage, pkgById, pkgByTitle, UPLOAD_DIR, uniqueTitle, uploadedFiles } from '../support/cms';
import { expect, gotoReady, submit, test } from '../support/fixtures';

// Hanya file ini yang menulis ke folder unggahan di proyek `main`, dan tes di dalamnya serial, sehingga
// membandingkan isi folder sebelum/sesudah aman. Paket yang dibuat adalah DRAFT berawalan "Tes Foto"
// (dibersihkan oleh e2e/mutating/cms.spec.ts; afterAll per worker akan berbahaya, lihat package-cms.spec.ts).
test.describe.configure({ mode: 'serial' });

const PW = 'sandi-admin-foto-1';
const PREFIX = 'Tes Foto';
let admin = '';
test.beforeAll(() => {
	admin = uniqueLogin('foto');
	insertAdmin(admin, PW);
});

const PNG_MIME = 'image/png';
const UPLOAD_PATH = /^\/uploads\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/;
const fileOf = (image: string) => join(UPLOAD_DIR, image.slice('/uploads/'.length));
const photoInput = (page: Page) => page.getByLabel(/^(Unggah|Ganti) foto/);

async function login(page: Page) {
	await adminLogin(page, admin, PW);
}
async function openEdit(page: Page, id: number) {
	await gotoReady(page, `/admin/paket/${id}`);
	await noClientValidation(page);
}
type Upload = { name: string; mimeType: string; buffer: Buffer };
/** Pilih berkas di halaman ubah dan simpan; mengembalikan paket sesudahnya. */
async function upload(page: Page, id: number, f: Upload, extra: Parameters<typeof fillPackage>[1] = {}) {
	await openEdit(page, id);
	await photoInput(page).setInputFiles(f);
	if (Object.keys(extra).length) await fillPackage(page, extra);
	await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
	return pkgById(id);
}
const draft = (label: string, over: Parameters<typeof insertPackage>[1] = {}) => insertPackage(uniqueTitle(`${PREFIX} ${label}`), over);

test.describe('[image-uploads] Format yang diterima', () => {
	for (const [label, buffer, ext, mime] of [
		['PNG', PNG, 'png', 'image/png'],
		['JPEG', JPEG, 'jpg', 'image/jpeg'],
		['WebP', WEBP, 'webp', 'image/webp'],
		['AVIF', AVIF, 'avif', 'image/avif']
	] as const) {
		test(`${label} diterima, disimpan dengan ekstensi .${ext}, dan disajikan sebagai ${mime}`, async ({ page, request }) => {
			await login(page);
			const p = draft(label);
			const after = await upload(page, p.id, file(`foto.${ext}`, buffer, mime));
			expect(after.image).toMatch(UPLOAD_PATH);
			expect(after.image).toMatch(new RegExp(`\\.${ext}$`));
			expect(readFileSync(fileOf(after.image!)).equals(buffer)).toBe(true);
			await expect(page.getByRole('status')).toContainText('disimpan');
			await expect(page.getByAltText('Foto saat ini')).toHaveAttribute('src', after.image!);
			const res = await request.get(after.image!);
			expect(res.status()).toBe(200);
			expect(res.headers()['content-type']).toBe(mime);
		});
	}

	test('PNG bernama .txt diterima karena isinya PNG dan tersimpan sebagai .png', async ({ page }) => {
		await login(page);
		const p = draft('NamaMenipu');
		const after = await upload(page, p.id, file('foto.txt', PNG, PNG_MIME));
		expect(after.image).toMatch(/\.png$/);
	});

	test('foto di formulir tambah: paket draft dibuat dengan fotonya', async ({ page }) => {
		await login(page);
		await gotoReady(page, '/admin/paket/baru');
		const title = uniqueTitle(`${PREFIX} Baru`);
		await fillPackage(page, { title, summary: 'Dengan foto.' });
		await photoInput(page).setInputFiles(file('baru.png', PNG, PNG_MIME));
		await submit(page, () => page.getByRole('button', { name: 'Simpan sebagai draft' }).click());
		const row = pkgByTitle(title);
		expect(row.image).toMatch(UPLOAD_PATH);
		expect(row.published).toBe(0);
		expect(existsSync(fileOf(row.image!))).toBe(true);
	});

	test('tanpa memilih berkas: foto yang ada tidak berubah', async ({ page }) => {
		await login(page);
		const p = draft('TanpaBerkas');
		const first = await upload(page, p.id, file('a.png', PNG, PNG_MIME));
		const filesBefore = uploadedFiles();
		await openEdit(page, p.id);
		await fillPackage(page, { summary: 'Ringkasan diganti tanpa foto baru.' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(pkgById(p.id)).toMatchObject({ image: first.image, summary: 'Ringkasan diganti tanpa foto baru.' });
		expect(uploadedFiles()).toEqual(filesBefore);
	});
});

test.describe('[image-uploads] Penolakan', () => {
	test('teks bernama .png ditolak (jenis dari isi) tanpa mengubah data atau meninggalkan berkas', async ({ page }) => {
		await login(page);
		const p = draft('TeksPng');
		const before = uploadedFiles();
		await upload(page, p.id, file('foto.png', TEXT, PNG_MIME), { summary: 'Tidak boleh tersimpan.' });
		expect(await alerts(page)).toEqual(['Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.']);
		expect(pkgById(p.id)).toMatchObject({ image: null, summary: 'Ringkasan uji.' });
		expect(uploadedFiles()).toEqual(before);
		// isian lain dipertahankan walau unggahan ditolak
		await expect(page.getByLabel('Ringkasan', { exact: true })).toHaveValue('Tidak boleh tersimpan.');
	});

	for (const [label, buffer] of [['SVG', SVG], ['GIF', GIF]] as const) {
		test(`${label} ditolak di server walau Content-Type berbohong`, async ({ page }) => {
			await login(page);
			const p = draft(label);
			const before = uploadedFiles();
			await upload(page, p.id, file(`foto.png`, buffer, PNG_MIME));
			expect(await alerts(page)).toEqual(['Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.']);
			expect(pkgById(p.id).image).toBeNull();
			expect(uploadedFiles()).toEqual(before);
		});
	}

	test('berkas kosong bernama ditolak', async ({ page }) => {
		await login(page);
		const p = draft('Kosong');
		await upload(page, p.id, file('kosong.png', Buffer.alloc(0), PNG_MIME));
		expect(await alerts(page)).toEqual(['Berkas foto kosong. Pilih foto lain.']);
		expect(pkgById(p.id).image).toBeNull();
	});

	test('4 MB + 1 byte ditolak di server dengan pesan batas; tepat 4 MB diterima', async ({ page, baseURL }) => {
		await login(page);
		const headers = { origin: new URL(baseURL!).origin };
		const before = uploadedFiles();
		const over = uniqueTitle(`${PREFIX} Besar`);
		const res = await page.request.post('/admin/paket/baru', {
			multipart: { title: over, summary: 'x', photo: file('besar.png', pngOfSize(4 * MB + 1), PNG_MIME) },
			headers
		});
		expect(await res.text()).toContain('Foto terlalu besar. Maksimal 4 MB.');
		expect(pkgByTitle(over)).toBeUndefined();
		expect(uploadedFiles()).toEqual(before);

		const exact = uniqueTitle(`${PREFIX} Pas`);
		await page.request.post('/admin/paket/baru', {
			multipart: { title: exact, summary: 'x', photo: file('pas.png', pngOfSize(4 * MB), PNG_MIME) },
			headers
		});
		const row = pkgByTitle(exact);
		expect(row?.image).toMatch(UPLOAD_PATH);
		expect(readFileSync(fileOf(row.image!)).length).toBe(4 * MB);
	});

	test('validasi lain gagal: foto valid tidak meninggalkan berkas baru', async ({ page }) => {
		await login(page);
		const p = draft('ValidasiGagal');
		const before = uploadedFiles();
		await upload(page, p.id, file('ok.png', PNG, PNG_MIME), { title: '' });
		expect(await alerts(page)).toEqual(['Nama paket wajib diisi.']);
		expect(uploadedFiles()).toEqual(before);
		expect(pkgById(p.id).image).toBeNull();
	});
});

test.describe('[image-uploads] Penyimpanan dan penggantian', () => {
	test('nama klien tidak dipakai: ../../etc/passwd.png tersimpan sebagai <uuid>.png di folder unggahan', async ({ page }) => {
		await login(page);
		const p = draft('Traversal');
		const before = uploadedFiles();
		const after = await upload(page, p.id, file('../../etc/passwd.png', PNG, PNG_MIME));
		expect(after.image).toMatch(UPLOAD_PATH);
		expect(after.image).not.toContain('passwd');
		const added = uploadedFiles().filter((f) => !before.includes(f));
		expect(added).toEqual([after.image!.slice('/uploads/'.length)]);
	});

	test('mengganti foto: image menunjuk berkas baru dan berkas lama terhapus', async ({ page }) => {
		await login(page);
		const p = draft('Ganti');
		const first = await upload(page, p.id, file('a.png', PNG, PNG_MIME));
		const second = await upload(page, p.id, file('b.jpg', JPEG, 'image/jpeg'));
		expect(second.image).not.toBe(first.image);
		expect(existsSync(fileOf(first.image!))).toBe(false);
		expect(existsSync(fileOf(second.image!))).toBe(true);
	});

	test('foto bawaan tidak dihapus ketika diganti atau dihapus', async ({ page, request }) => {
		await login(page);
		const p = draft('Bawaan', { image: '/media/forest.svg' });
		await expect(async () => expect((await request.get('/media/forest.svg')).status()).toBe(200)).toPass();
		const replaced = await upload(page, p.id, file('a.png', PNG, PNG_MIME));
		expect(replaced.image).toMatch(UPLOAD_PATH);
		expect((await request.get('/media/forest.svg')).status()).toBe(200);

		const q = draft('BawaanHapus', { image: '/media/forest.svg' });
		await openEdit(page, q.id);
		await page.getByLabel('Hapus foto ini').check();
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(pkgById(q.id).image).toBeNull();
		expect((await request.get('/media/forest.svg')).status()).toBe(200);
	});

	test('"Hapus foto" mengosongkan image, menghapus berkasnya, dan pratinjau hilang', async ({ page }) => {
		await login(page);
		const p = draft('HapusFoto');
		const withPhoto = await upload(page, p.id, file('a.png', PNG, PNG_MIME));
		await openEdit(page, p.id);
		await page.getByLabel('Hapus foto ini').check();
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(pkgById(p.id).image).toBeNull();
		expect(existsSync(fileOf(withPhoto.image!))).toBe(false);
		await expect(page.getByLabel('Hapus foto ini')).toHaveCount(0);
		await expect(page.getByLabel(/^Unggah foto/)).toBeVisible();
	});

	test('menghapus paket menghapus berkas fotonya', async ({ page }) => {
		await login(page);
		const p = draft('HapusPaket');
		const withPhoto = await upload(page, p.id, file('a.png', PNG, PNG_MIME));
		await gotoReady(page, '/admin/paket');
		page.once('dialog', (d) => d.accept());
		await submit(page, () =>
			page.locator(`li[data-package="${p.slug}"]`).getByRole('button', { name: 'Hapus', exact: true }).click()
		);
		expect(pkgById(p.id)).toBeUndefined();
		expect(existsSync(fileOf(withPhoto.image!))).toBe(false);
	});
});

test.describe('[image-uploads] Penyajian /uploads', () => {
	test('berkas ada: 200 dengan header keamanan, tanpa login', async ({ page, playwright, baseURL, extraHTTPHeaders }) => {
		await login(page);
		const p = draft('Sajian');
		const after = await upload(page, p.id, file('a.png', PNG, PNG_MIME));
		const anon = await playwright.request.newContext({ baseURL, extraHTTPHeaders }); // tanpa cookie sesi
		const res = await anon.get(after.image!);
		expect(res.status()).toBe(200);
		expect(res.headers()).toMatchObject({
			'content-type': 'image/png',
			'x-content-type-options': 'nosniff',
			'cache-control': 'public, max-age=31536000, immutable',
			'content-security-policy': "default-src 'none'; img-src 'self'"
		});
		expect((await res.body()).equals(PNG)).toBe(true);
		await anon.dispose();
	});

	test('tidak ada atau nama tidak berpola → 404', async ({ request }) => {
		const uuid = '123e4567-e89b-42d3-a456-426614174000';
		for (const name of [`${uuid}.png`, 'foto.png', `${uuid}.svg`, `${uuid.toUpperCase()}.png`, '%2e%2e%2fpackage.json', '..%2f..%2fapp.db', `${uuid}.png.txt`, '.env']) {
			const res = await request.get(`/uploads/${name}`);
			expect(res.status(), name).toBe(404);
			expect(await res.text(), name).not.toContain('lembang-adventures'); // isi package.json tidak bocor
		}
		expect((await request.get('/uploads/')).status()).toBe(404);
	});

	test('SVG yang berhasil ditaruh di folder tetap tidak disajikan', async ({ request }) => {
		// Pola nama menolak ekstensi svg, jadi berkas semacam itu tidak pernah bisa diminta.
		expect((await request.get('/uploads/123e4567-e89b-42d3-a456-426614174000.svg')).status()).toBe(404);
	});
});

test.describe('[image-uploads] Pemeriksaan di sisi klien', () => {
	test('berkas 6 MB: pesan batas ukuran muncul, pilihan dibatalkan, dan tidak ada permintaan unggah', async ({ page }) => {
		await login(page);
		const p = draft('KlienBesar');
		await openEdit(page, p.id);
		let posts = 0;
		page.on('request', (r) => r.method() === 'POST' && posts++);
		await photoInput(page).setInputFiles(file('besar.png', pngOfSize(6 * MB), PNG_MIME));
		await expect(page.getByRole('alert')).toHaveText('Foto terlalu besar. Maksimal 4 MB.');
		expect(await photoInput(page).evaluate((el: HTMLInputElement) => el.files!.length)).toBe(0);
		await page.evaluate(() => 0); // putaran balik ke halaman: permintaan yang tertunda (bila ada) sudah terkirim
		expect(posts).toBe(0);
		expect(pkgById(p.id).image).toBeNull();
	});

	test('jenis yang tidak didukung (GIF) ditolak sebelum dikirim; memilih ulang berkas valid menghapus pesan', async ({ page }) => {
		await login(page);
		const p = draft('KlienJenis');
		await openEdit(page, p.id);
		await photoInput(page).setInputFiles(file('a.gif', GIF, 'image/gif'));
		await expect(page.getByRole('alert')).toHaveText('Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.');
		await photoInput(page).setInputFiles(file('a.png', PNG, PNG_MIME));
		await expect(page.getByRole('alert')).toHaveCount(0);
	});

	test('isian berkas membatasi pilihan dengan accept', async ({ page }) => {
		await login(page);
		const p = draft('Accept');
		await openEdit(page, p.id);
		await expect(photoInput(page)).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/avif');
	});
});
