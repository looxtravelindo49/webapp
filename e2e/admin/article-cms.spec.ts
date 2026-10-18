import type { Page } from '@playwright/test';
import { adminLogin, alerts, noClientValidation, path } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { articleById, articleByTitle, fillArticle, insertArticle, slugOf, uniqueTitle, type ArticleFormValues } from '../support/articles';
import { query } from '../support/db';
import { expect, gotoReady, submit, test } from '../support/fixtures';

// Hanya membuat/mengubah/menghapus artikel DRAF buatan sendiri (awalan "Tes Artikel"), tanpa unggah foto:
// artikel terbit dan berkas unggahan dipakai tes lain yang berjalan paralel. Alur terbit, populer, dan
// sampul ada di e2e/mutating/articles.spec.ts, yang juga membersihkan sisa draf di sini.
const PW = 'sandi-admin-artikel-1';
const PREFIX = 'Tes Artikel';
let admin = '';

test.beforeAll(() => {
	admin = uniqueLogin('artikel');
	insertAdmin(admin, PW);
});

const rowOf = (page: Page, slug: string) => page.locator(`li[data-article="${slug}"]`);

const loggedIn = new WeakSet<Page>();
async function openNew(page: Page) {
	if (!loggedIn.has(page)) await adminLogin(page, admin, PW);
	loggedIn.add(page);
	await gotoReady(page, '/admin/artikel/baru');
	await noClientValidation(page);
	// maxlength membuat peramban memotong ketikan; lepas agar batas panjang di server bisa diuji.
	await page.evaluate(() => document.querySelectorAll('[maxlength]').forEach((e) => e.removeAttribute('maxlength')));
}
async function create(page: Page, values: ArticleFormValues) {
	await openNew(page);
	await fillArticle(page, { category: 'TES', excerpt: 'Ringkasan uji.', body: 'Isi uji.', ...values });
	return submit(page, () => page.getByRole('button', { name: 'Simpan sebagai draf' }).click());
}

test.describe('[article-cms] Daftar artikel di admin', () => {
	test('menampilkan draf dan artikel terbit dengan status, kategori, dan penanda populer', async ({ page }) => {
		const draft = uniqueTitle(`${PREFIX} Daftar`);
		insertArticle(draft, { category: 'DAFTAR' });
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/artikel');
		await expect(rowOf(page, slugOf(draft))).toContainText('Draf');
		await expect(rowOf(page, slugOf(draft))).toContainText('DAFTAR');
		await expect(rowOf(page, slugOf(draft)).getByRole('button', { name: 'Jadikan populer' })).toBeVisible();
		const seeded = rowOf(page, 'sepakati-5-hal-sebelum-gathering-kantor');
		await expect(seeded).toContainText('Terbit');
		await expect(seeded).toContainText('Populer');
		await expect(seeded).toContainText('terbit 15 September 2026');
		await expect(seeded.getByRole('button', { name: 'Lepas populer' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Tambah artikel' })).toHaveAttribute('href', '/admin/artikel/baru');
	});
});

test.describe('[article-cms] Tambah artikel', () => {
	test('artikel baru: draf, tidak populer, slug otomatis, tidak tampil di situs publik', async ({ page, request }) => {
		const title = uniqueTitle(`${PREFIX} Baru`);
		await create(page, { title, category: 'PERENCANAAN', excerpt: 'Ringkas.', body: '## Subjudul\n\nIsi.' });
		const row = articleByTitle(title);
		expect(row).toMatchObject({ slug: slugOf(title), published: 0, featured: 0, published_at: null, cover_image: null, body: '## Subjudul\n\nIsi.' });
		expect(path(page)).toBe(`/admin/artikel/${row.id}`);
		await expect(page.getByRole('status')).toContainText('draf');
		await expect(page.getByLabel('Judul', { exact: true })).toHaveValue(title);
		expect((await request.get(`/artikel/${row.slug}`)).status()).toBe(404);
	});

	test('judul yang sama mendapat slug dengan sufiks -2', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Kembar`);
		insertArticle(title);
		await create(page, { title });
		expect(query<{ slug: string }>('SELECT slug FROM article WHERE title = ? ORDER BY id', title).map((r) => r.slug)).toEqual([slugOf(title), `${slugOf(title)}-2`]);
	});

	test('slug hanya berisi a-z, 0-9, dan tanda hubung', async ({ page }) => {
		const tag = Date.now().toString(36);
		await create(page, { title: `${PREFIX} Café & Ñandú 100%! ${tag}` });
		expect(articleByTitle(`${PREFIX} Café & Ñandú 100%! ${tag}`).slug).toBe(`tes-artikel-cafe-nandu-100-${tag}`);
	});
});

test.describe('[article-cms] Validasi masukan artikel', () => {
	test('judul kosong: pesan pada isian, terhubung lewat aria-describedby, isian lain dipertahankan', async ({ page }) => {
		const marker = uniqueTitle(`${PREFIX} Ringkasan`);
		await create(page, { title: '   ', excerpt: marker, category: 'KATEGORI-UJI', body: 'isi yang diketik' });
		expect(path(page)).toBe('/admin/artikel/baru');
		expect(await alerts(page)).toEqual(['Judul wajib diisi.']);
		const title = page.getByLabel('Judul', { exact: true });
		await expect(title).toHaveAttribute('aria-invalid', 'true');
		const describedBy = await title.getAttribute('aria-describedby');
		expect(await page.locator(`[id="${describedBy}"]`).innerText()).toBe('Judul wajib diisi.');
		await expect(page.getByLabel('Ringkasan', { exact: true })).toHaveValue(marker);
		await expect(page.getByLabel('Kategori')).toHaveValue('KATEGORI-UJI');
		await expect(page.getByLabel('Isi artikel')).toHaveValue('isi yang diketik');
		expect(query('SELECT 1 FROM article WHERE excerpt = ?', marker)).toHaveLength(0);
	});

	test('ringkasan terlalu panjang menyebut batasnya dan data tidak berubah', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Panjang`);
		await create(page, { title, excerpt: 'x'.repeat(301) });
		expect(await alerts(page)).toEqual(['Ringkasan maksimal 300 karakter.']);
		expect(articleByTitle(title)).toBeUndefined();
	});

	test('kategori dan ringkasan wajib', async ({ page }) => {
		await create(page, { title: uniqueTitle(`${PREFIX} Wajib`), category: '', excerpt: '' });
		expect(await alerts(page)).toEqual(['Kategori wajib diisi.', 'Ringkasan wajib diisi.']);
	});

	test('menerbitkan artikel tanpa isi dari form ditolak dan status tidak berubah', async ({ page }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} KosongForm`), { body: '' });
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		await page.getByLabel('Tampilkan di situs').check();
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(await alerts(page)).toEqual(['Isi artikel wajib diisi sebelum diterbitkan.']);
		expect(articleById(row.id)).toMatchObject({ published: 0, published_at: null });
	});

	test('tombol Terbitkan di daftar menolak artikel tanpa isi', async ({ page }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} KosongDaftar`), { body: '' });
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/artikel');
		await submit(page, () => rowOf(page, row.slug).getByRole('button', { name: 'Terbitkan' }).click());
		await expect(rowOf(page, row.slug).getByRole('alert')).toHaveText('Isi artikel wajib diisi sebelum diterbitkan.');
		expect(articleById(row.id).published).toBe(0);
	});
});

test.describe('[article-cms] Ubah artikel', () => {
	test('form terisi nilai tersimpan; slug tetap saat judul diganti; updated_at berubah', async ({ page }) => {
		const title = uniqueTitle(`${PREFIX} Ubah`);
		const row = insertArticle(title, { category: 'ASAL', excerpt: 'ringkas asal', body: 'isi asal' });
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/artikel/${row.id}`);
		await expect(page.getByLabel('Judul', { exact: true })).toHaveValue(title);
		await expect(page.getByLabel('Kategori')).toHaveValue('ASAL');
		await expect(page.getByLabel('Isi artikel')).toHaveValue('isi asal');
		await expect(page.getByLabel('Tampilkan di situs')).not.toBeChecked();
		await expect(page.getByText(`/artikel/${row.slug}`).first()).toBeVisible();

		await new Promise((r) => setTimeout(r, 15)); // updated_at bermilidetik
		await fillArticle(page, { title: `${title} Baru`, body: 'isi baru' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		await expect(page.getByRole('status')).toContainText('disimpan');
		const after = articleById(row.id);
		expect(after).toMatchObject({ slug: row.slug, title: `${title} Baru`, body: 'isi baru', published: 0, published_at: null });
		expect(after.updated_at >= row.updated_at).toBe(true);
	});

	test('id yang tidak ada → 404', async ({ page }) => {
		await adminLogin(page, admin, PW);
		const res = await page.goto('/admin/artikel/999999');
		expect(res?.status()).toBe(404);
		expect((await page.goto('/admin/artikel/abc'))?.status()).toBe(404);
	});
});

test.describe('[article-cms] Hapus artikel', () => {
	test('konfirmasi dibatalkan: tidak ada permintaan hapus dan artikel tetap', async ({ page }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} Batal`));
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/artikel');
		let deletes = 0;
		page.on('request', (r) => r.method() === 'POST' && r.url().includes('hapus') && deletes++);
		const messages: string[] = [];
		page.once('dialog', (d) => { messages.push(d.message()); void d.dismiss(); });
		await rowOf(page, row.slug).getByRole('button', { name: 'Hapus', exact: true }).click();
		await expect.poll(() => messages.length).toBe(1);
		expect(messages[0]).toContain(row.title);
		await page.evaluate(() => 0);
		expect(deletes).toBe(0);
		expect(articleById(row.id)).toBeTruthy();
	});

	test('dikonfirmasi: artikel hilang dari daftar dan database', async ({ page }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} Hapus`), { cover_image: '/media/forest.svg' });
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/artikel');
		page.once('dialog', (d) => d.accept());
		await submit(page, () => rowOf(page, row.slug).getByRole('button', { name: 'Hapus', exact: true }).click());
		await expect(page.getByRole('status')).toContainText('dihapus');
		await expect(rowOf(page, row.slug)).toHaveCount(0);
		expect(articleById(row.id)).toBeUndefined();
		expect((await page.request.get('/media/forest.svg')).status()).toBe(200); // gambar bawaan tidak dihapus
	});

	test('hapus tanpa tanda konfirmasi ditolak di server', async ({ page, baseURL }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} TanpaKonfirmasi`));
		await adminLogin(page, admin, PW);
		const res = await page.request.post('/admin/artikel?/hapus', { form: { id: String(row.id) }, headers: { origin: new URL(baseURL!).origin } });
		expect(await res.text()).toContain('Penghapusan perlu konfirmasi');
		expect(articleById(row.id)).toBeTruthy();
	});

	test('hapus artikel yang sudah tidak ada → "Artikel tidak ditemukan."', async ({ page, baseURL }) => {
		await adminLogin(page, admin, PW);
		const res = await page.request.post('/admin/artikel?/hapus', { form: { id: '987654', confirm: 'yes' }, headers: { origin: new URL(baseURL!).origin } });
		expect(await res.text()).toContain('Artikel tidak ditemukan.');
	});
});

test.describe('[article-cms] Akses terbatas', () => {
	const pages = ['/admin/artikel', '/admin/artikel/baru', '/admin/artikel/1'];

	test('tanpa sesi: halaman dialihkan ke login', async ({ page }) => {
		for (const url of pages) {
			await gotoReady(page, url);
			expect(path(page), url).toBe('/admin/login');
		}
	});

	test('tanpa sesi: POST ke aksi dialihkan ke login dan tidak mengubah data', async ({ request, baseURL }) => {
		const row = insertArticle(uniqueTitle(`${PREFIX} TanpaSesi`));
		const headers = { origin: new URL(baseURL!).origin };
		for (const action of ['terbit', 'populer', 'hapus']) {
			const res = await request.post(`/admin/artikel?/${action}`, { form: { id: String(row.id), confirm: 'yes' }, headers, maxRedirects: 0 });
			expect([200, 303], action).toContain(res.status());
			if (res.status() === 200) expect((await res.json()).type).toBe('redirect');
			else expect(res.headers().location).toBe('/admin/login');
		}
		const res = await request.post('/admin/artikel/baru', { multipart: { title: 'Tes Artikel Tanpa Sesi Dibuat', category: 'x', excerpt: 'x' }, headers, maxRedirects: 0 });
		expect([200, 303]).toContain(res.status());
		expect(articleById(row.id)).toMatchObject({ published: 0, featured: 0 });
		expect(articleByTitle('Tes Artikel Tanpa Sesi Dibuat')).toBeUndefined();
	});

	test('akun yang wajib ganti password diarahkan ke halaman ganti password', async ({ page }) => {
		const login = uniqueLogin('artikel-wajib');
		insertAdmin(login, PW, { mustChange: true });
		await adminLogin(page, login, PW);
		for (const url of pages) {
			await gotoReady(page, url);
			expect(path(page), url).toBe('/admin/ganti-password');
		}
	});
});
