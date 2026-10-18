import type { Page } from '@playwright/test';
import { adminLogin, alerts, noClientValidation } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { articleById, articleByTitle, fillArticle, insertArticle, uniqueTitle } from '../support/articles';
import { file, PNG } from '../support/assets';
import { exec } from '../support/db';
import { UNSPLASH_KEY } from '../support/env';
import { expect, gotoReady, submit, test } from '../support/fixtures';
import { countCalls, downloadCalls, openPicker, photoCalls, pickPhoto, search, searchCalls, stubCalls, uniqueQuery, type StubCall } from '../support/unsplash';

// Hanya artikel DRAF buatan sendiri (awalan "Tes Unsplash") dan tanpa unggah berkas, supaya aman berjalan paralel
// dengan tes lain; sisa draf dibersihkan oleh e2e/mutating/articles.spec.ts. Server Unsplash tiruan: e2e/support/unsplash-stub.mjs.
const PW = 'sandi-admin-unsplash-1';
const PREFIX = 'Tes Unsplash';
let admin = '';
test.beforeAll(() => {
	admin = uniqueLogin('unsplash');
	insertAdmin(admin, PW);
});

const loggedIn = new WeakSet<Page>();
async function login(page: Page) {
	if (!loggedIn.has(page)) await adminLogin(page, admin, PW);
	loggedIn.add(page);
}
async function openNew(page: Page) {
	await login(page);
	await gotoReady(page, '/admin/artikel/baru');
	await noClientValidation(page);
}
async function openEdit(page: Page, id: number) {
	await login(page);
	await gotoReady(page, `/admin/artikel/${id}`);
	await noClientValidation(page);
}
const save = (page: Page, name = 'Simpan perubahan') => submit(page, () => page.getByRole('button', { name }).click());
const unsplashCols = (id: number) => {
	const a = articleById(id) as unknown as Record<string, string | null>;
	return { image: a.cover_image, name: a.cover_credit_name, url: a.cover_credit_url, id: a.cover_unsplash_id };
};
const withCover = (title: string, photoId: string) => {
	const row = insertArticle(title);
	exec(
		'UPDATE article SET cover_image = ?, cover_credit_name = ?, cover_credit_url = ?, cover_unsplash_id = ? WHERE id = ?',
		`https://images.unsplash.com/photo-${photoId}?ixlib=rb-4.1.0&ixid=ID${photoId}`, `Fotografer ${photoId}`, `https://unsplash.com/@fotografer_${photoId}`, photoId, row.id
	);
	return row;
};

test.describe('[unsplash-picker] Konfigurasi', () => {
	test('dengan kunci, tombol tampil di form baru dan ubah; kunci tidak ada di HTML', async ({ page }) => {
		await openNew(page);
		await expect(page.getByRole('button', { name: 'Cari di Unsplash' })).toBeVisible();
		expect(await page.content()).not.toContain(UNSPLASH_KEY);
		const row = insertArticle(uniqueTitle(`${PREFIX} Konfigurasi`));
		await openEdit(page, row.id);
		await expect(page.getByRole('button', { name: 'Cari di Unsplash' })).toBeVisible();
		await expect(page.getByLabel(/^Unggah foto/)).toBeVisible(); // unggahan tetap tersedia
		expect(await page.content()).not.toContain(UNSPLASH_KEY);
	});
});

test.describe('[unsplash-picker] Pencarian lewat proxy server', () => {
	test('parameter tetap, hasil ter-normalisasi, dan kunci tidak bocor di respons', async ({ page }) => {
		await login(page);
		const q = uniqueQuery('pegunungan');
		const res = await page.request.get(`/admin/artikel/unsplash?q=${encodeURIComponent(`  ${q}  `)}&page=2`);
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('application/json');
		const text = await res.text();
		expect(text).not.toContain(UNSPLASH_KEY);
		expect(text).not.toContain('download_location');
		const body = JSON.parse(text);
		expect(body).toMatchObject({ total: 30, totalPages: 3, page: 2 });
		expect(body.results).toHaveLength(12);
		expect(body.results[0]).toEqual({
			id: 'fotouji13', thumb: expect.stringMatching(/^https:\/\/images\.unsplash\.com\//), alt: 'foto uji fotouji13', width: 4000, height: 3000,
			user: { name: 'Fotografer fotouji13', url: 'https://unsplash.com/@fotografer_fotouji13' }
		});
		const call = (await stubCalls()).find((c) => c.path === 'search' && c.query === q)!;
		expect(call.params).toMatchObject({ per_page: '12', orientation: 'landscape', content_filter: 'high', page: '2' });
	});

	test('masukan tidak valid → 400 tanpa memanggil Unsplash', async ({ page }) => {
		await login(page);
		// Panggilan ke Unsplash tiruan bersifat global (tes lain berjalan paralel), jadi yang dihitung hanya
		// panggilan dengan kueri yang diuji di sini.
		const marker = uniqueQuery('tidakvalid');
		const watched = (c: StubCall) => c.path === 'search' && (c.query === '' || c.query === 'a' || c.query === marker || (c.query?.length ?? 0) > 80);
		const before = await countCalls(watched);
		const cases = ['', 'q=', 'q=a', `q=${'a'.repeat(81)}`, `q=${encodeURIComponent(marker)}&page=0`, `q=${encodeURIComponent(marker)}&page=21`, `q=${encodeURIComponent(marker)}&page=abc`];
		for (const qs of cases) {
			const res = await page.request.get(`/admin/artikel/unsplash?${qs}`);
			expect(res.status(), qs).toBe(400);
			expect(await res.json()).toEqual({ error: 'invalid' });
		}
		expect(await countCalls(watched)).toBe(before);
	});

	test('hasil yang sama disajikan dari cache: Unsplash dipanggil sekali', async ({ page }) => {
		await login(page);
		const q = uniqueQuery('cache');
		for (let i = 0; i < 3; i++) expect((await page.request.get(`/admin/artikel/unsplash?q=${encodeURIComponent(q)}`)).status()).toBe(200);
		expect(await searchCalls(q)).toBe(1);
	});

	test('jatah habis → 429, tidak tersedia → 502', async ({ page }) => {
		await login(page);
		const limited = await page.request.get('/admin/artikel/unsplash?q=limit');
		expect(limited.status()).toBe(429);
		expect(await limited.json()).toEqual({ error: 'rate-limited' });
		const broken = await page.request.get('/admin/artikel/unsplash?q=rusak');
		expect(broken.status()).toBe(502);
		expect(await broken.json()).toEqual({ error: 'unavailable' });
	});

	test('tanpa sesi: dialihkan ke login dan Unsplash tidak dipanggil', async ({ request }) => {
		const q = uniqueQuery('tanpasesi');
		const res = await request.get(`/admin/artikel/unsplash?q=${encodeURIComponent(q)}`, { maxRedirects: 0 });
		expect(res.status()).toBe(303);
		expect(res.headers().location).toBe('/admin/login');
		expect(await searchCalls(q)).toBe(0);
	});
});

test.describe('[unsplash-picker] Antarmuka pemilih', () => {
	test('mencari, menampilkan 12 hasil, dan "Muat lebih banyak" sampai habis', async ({ page }) => {
		await openNew(page);
		await openPicker(page);
		const dialog = await search(page, uniqueQuery('hutan'));
		const results = dialog.getByRole('button', { name: /^Pilih foto/ });
		await expect(results).toHaveCount(12);
		await expect(results.first()).toHaveAccessibleName('Pilih foto foto uji fotouji01, oleh Fotografer fotouji01');
		await dialog.getByRole('button', { name: 'Muat lebih banyak' }).click();
		await expect(results).toHaveCount(24);
		await dialog.getByRole('button', { name: 'Muat lebih banyak' }).click();
		await expect(results).toHaveCount(30);
		await expect(dialog.getByRole('button', { name: 'Muat lebih banyak' })).toHaveCount(0);
	});

	test('Enter di kolom cari mencari dan tidak mengirim formulir artikel', async ({ page }) => {
		await openNew(page);
		let posts = 0;
		page.on('request', (r) => r.method() === 'POST' && posts++);
		await openPicker(page);
		const dialog = await search(page, uniqueQuery('enter'));
		await expect(dialog.getByRole('button', { name: /^Pilih foto/ }).first()).toBeVisible();
		expect(posts).toBe(0);
	});

	test('tanpa hasil, jatah habis, dan Unsplash tidak tersedia menampilkan pesan masing-masing; unggahan tetap bisa dipakai', async ({ page }) => {
		await openNew(page);
		await openPicker(page);
		const dialog = await search(page, 'kosong');
		await expect(dialog.getByText('Tidak ada foto yang cocok')).toBeVisible();
		await search(page, 'limit');
		await expect(dialog.getByRole('alert')).toContainText('Jatah pencarian Unsplash sedang habis');
		await search(page, 'rusak');
		await expect(dialog.getByRole('alert')).toContainText('Unsplash tidak dapat dihubungi');
		await page.keyboard.press('Escape');
		await expect(page.locator('dialog[open]')).toHaveCount(0);
		await expect(page.getByLabel(/^Unggah foto/)).toBeVisible();
	});

	test('kueri satu karakter ditolak di sisi klien tanpa memanggil server', async ({ page }) => {
		await openNew(page);
		await openPicker(page);
		const dialog = await search(page, 'a');
		await expect(dialog.getByRole('alert')).toContainText('Ketik minimal 2 karakter');
		expect(await searchCalls('a')).toBe(0);
	});

	test('memilih dengan keyboard: pratinjau, kredit, dan isian tersembunyi terisi; "Batalkan pilihan" mengosongkannya', async ({ page }) => {
		await openNew(page);
		await openPicker(page);
		const dialog = await search(page, uniqueQuery('keyboard'));
		const first = dialog.getByRole('button', { name: /^Pilih foto/ }).first();
		await expect(first).toBeVisible();
		await first.focus();
		await page.keyboard.press('Enter');
		await expect(page.locator('dialog[open]')).toHaveCount(0);
		const picked = page.getByTestId('unsplash-picked');
		await expect(picked).toContainText('Foto oleh Fotografer fotouji01 di Unsplash');
		await expect(picked).toContainText('setelah artikel disimpan');
		await expect(page.locator('input[name=unsplash_id]')).toHaveValue('fotouji01');
		await page.getByRole('button', { name: 'Batalkan pilihan' }).click();
		await expect(picked).toHaveCount(0);
		await expect(page.locator('input[name=unsplash_id]')).toHaveValue('');
	});

	test('memilih berkas membatalkan pilihan Unsplash', async ({ page }) => {
		await openNew(page);
		await pickPhoto(page);
		await expect(page.getByTestId('unsplash-picked')).toBeVisible();
		await page.getByLabel(/^Unggah foto/).setInputFiles(file('a.png', PNG, 'image/png'));
		await expect(page.getByTestId('unsplash-picked')).toHaveCount(0);
		await expect(page.locator('input[name=unsplash_id]')).toHaveValue('');
	});

	test('memilih foto Unsplash mengosongkan berkas yang sudah dipilih', async ({ page }) => {
		await openNew(page);
		await page.getByLabel(/^Unggah foto/).setInputFiles(file('a.png', PNG, 'image/png'));
		await pickPhoto(page);
		expect(await page.getByLabel(/^Unggah foto/).evaluate((el: HTMLInputElement) => el.files?.length ?? 0)).toBe(0);
	});
});

test.describe('[unsplash-picker] Memilih foto sebagai sampul', () => {
	test('artikel baru: URL, kredit, dan id dari API tersimpan; unduhan dilaporkan tepat sekali setelah simpan', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Baru`);
		await openNew(page);
		await fillArticle(page, { title, category: 'UJI', excerpt: 'Ringkas.', body: 'Isi.' });
		const id = await pickPhoto(page, uniqueQuery('baru'), 3);
		expect(await downloadCalls(id)).toBe(0); // dipilih saja belum dihitung
		const photosBefore = await photoCalls(id);
		const downloadsBefore = await downloadCalls(id);
		await save(page, 'Simpan sebagai draf');

		const row = articleByTitle(title);
		expect(unsplashCols(row.id)).toEqual({
			image: `https://images.unsplash.com/photo-${id}?ixlib=rb-4.1.0&ixid=ID${id}`,
			name: `Fotografer ${id}`,
			url: `https://unsplash.com/@fotografer_${id}`,
			id
		});
		expect(await photoCalls(id)).toBe(photosBefore + 1);
		expect(await downloadCalls(id)).toBe(downloadsBefore + 1);
		await expect(page.getByText(`Foto Unsplash oleh Fotografer ${id}.`)).toBeVisible();
		await expect(page.locator('img[alt="Sampul saat ini"]')).toHaveAttribute('src', /^https:\/\/images\.unsplash\.com\/photo-fotouji\d+\?.*w=160/);
	});

	test('validasi gagal: tidak ada artikel dibuat dan unduhan tidak dilaporkan', async ({ page }) => {
		const marker = uniqueTitle(`${PREFIX} Gagal`);
		await openNew(page);
		await fillArticle(page, { title: '  ', category: 'UJI', excerpt: marker, body: 'Isi.' });
		const id = await pickPhoto(page, uniqueQuery('gagal'), 5);
		const before = await downloadCalls(id);
		await save(page, 'Simpan sebagai draf');
		expect(await alerts(page)).toEqual(['Judul wajib diisi.']);
		expect(await downloadCalls(id)).toBe(before);
		await expect(page.getByLabel('Ringkasan', { exact: true })).toHaveValue(marker);
	});

	test('artikel yang ada: mengganti sampul bawaan dengan foto Unsplash', async ({ page }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} Ubah`), { cover_image: '/media/forest.svg' });
		await openEdit(page, row.id);
		const id = await pickPhoto(page, uniqueQuery('ubah'), 6);
		const before = await downloadCalls(id);
		await save(page);
		expect(unsplashCols(row.id)).toMatchObject({ id, name: `Fotografer ${id}` });
		expect(await downloadCalls(id)).toBe(before + 1);
	});

	test('foto yang sama dengan yang tersimpan: tanpa panggilan ke Unsplash dan data tidak berubah', async ({ page }) => {
		const row = withCover(uniqueTitle(`${PREFIX} Sama`), 'fotouji07');
		const before = unsplashCols(row.id);
		const photos = await photoCalls('fotouji07');
		const downloads = await downloadCalls('fotouji07');
		await openEdit(page, row.id);
		await pickPhoto(page, uniqueQuery('sama'), 6); // hasil ke-7 halaman pertama = fotouji07
		await expect(page.locator('input[name=unsplash_id]')).toHaveValue('fotouji07');
		await save(page);
		expect(unsplashCols(row.id)).toEqual(before);
		expect(await photoCalls('fotouji07')).toBe(photos);
		expect(await downloadCalls('fotouji07')).toBe(downloads);
	});

	test('"Hapus foto ini" mengosongkan sampul Unsplash beserta kreditnya', async ({ page }) => {
		const row = withCover(uniqueTitle(`${PREFIX} Hapus`), 'fotouji08');
		await openEdit(page, row.id);
		await expect(page.getByText('Foto Unsplash oleh Fotografer fotouji08.')).toBeVisible();
		await page.getByLabel('Hapus foto ini').check();
		await save(page);
		expect(unsplashCols(row.id)).toEqual({ image: null, name: null, url: null, id: null });
	});

	test('klien tidak dapat memalsukan URL atau kredit: yang tersimpan selalu dari API', async ({ page, baseURL }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} Palsu`));
		await login(page);
		await page.request.post(`/admin/artikel/${row.id}`, {
			form: {
				title: row.title, category: 'UJI', excerpt: 'Ringkas.', body: 'Isi.',
				unsplash_id: 'fotouji09', cover_image: 'https://evil.example/x.jpg', cover_credit_name: 'Palsu', cover_credit_url: 'https://evil.example', cover_unsplash_id: 'lain'
			},
			headers: { origin: new URL(baseURL!).origin }
		});
		expect(unsplashCols(row.id)).toEqual({
			image: 'https://images.unsplash.com/photo-fotouji09?ixlib=rb-4.1.0&ixid=IDfotouji09',
			name: 'Fotografer fotouji09',
			url: 'https://unsplash.com/@fotografer_fotouji09',
			id: 'fotouji09'
		});
	});

	test('id tidak valid, tidak ada, dan Unsplash gagal: pesan pada isian foto dan data tidak berubah', async ({ page }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} Galat`));
		const cases: [string, string][] = [
			['abc/../x', 'Foto Unsplash tidak valid. Pilih foto lagi.'],
			['hilang01', 'Foto Unsplash tidak ditemukan. Pilih foto lain.'],
			['rusak001', 'Unsplash tidak dapat dihubungi. Coba lagi nanti atau unggah foto sendiri.']
		];
		for (const [id, message] of cases) {
			await openEdit(page, row.id);
			await fillArticle(page, { title: `${row.title} Diubah` });
			await page.locator('input[name=unsplash_id]').evaluate((el: HTMLInputElement, v) => (el.value = v), id);
			await save(page);
			expect(await alerts(page), id).toEqual([message]);
			expect(articleById(row.id)).toMatchObject({ title: row.title, cover_image: null });
		}
	});

	test('berkas dan foto Unsplash sekaligus ditolak', async ({ page }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} Ganda`));
		await openEdit(page, row.id);
		await fillArticle(page, { title: `${row.title} Diubah` });
		await page.getByLabel(/^Unggah foto/).setInputFiles(file('a.png', PNG, 'image/png'));
		await page.locator('input[name=unsplash_id]').evaluate((el: HTMLInputElement) => (el.value = 'fotouji10'));
		const before = await downloadCalls('fotouji10');
		await save(page);
		expect(await alerts(page)).toEqual(['Pilih salah satu: unggah foto atau pakai foto Unsplash.']);
		expect(articleById(row.id)).toMatchObject({ title: row.title, cover_image: null });
		expect(await downloadCalls('fotouji10')).toBe(before);
	});
});

test.describe('[unsplash-picker] Akses terbatas', () => {
	test('tanpa sesi: POST form artikel dengan unsplash_id tidak mengubah data dan tidak memanggil Unsplash', async ({ request, baseURL }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} TanpaSesi`));
		const before = await photoCalls('fotouji11');
		const res = await request.post(`/admin/artikel/${row.id}`, {
			form: { title: 'x', category: 'x', excerpt: 'x', unsplash_id: 'fotouji11' },
			headers: { origin: new URL(baseURL!).origin },
			maxRedirects: 0
		});
		expect([200, 303]).toContain(res.status());
		expect(articleById(row.id)).toMatchObject({ title: row.title, cover_image: null });
		expect(await photoCalls('fotouji11')).toBe(before);
	});
});
