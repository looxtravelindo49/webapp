import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { adminLogin, alerts, noClientValidation } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { file, PNG, JPEG } from '../support/assets';
import { articleByTitle, articleById, cleanupArticles, fillArticle, insertArticle, slugOf, uniqueTitle } from '../support/articles';
import { UPLOAD_DIR } from '../support/cms';
import { exec, query } from '../support/db';
import { downloadCalls, pickPhoto, uniqueQuery } from '../support/unsplash';
import { expect, gotoReady, submit, test } from '../support/fixtures';

// Tes yang mengubah apa yang dibaca halaman publik (terbit, populer, sampul). Berada di proyek `mutating-articles`
// (setelah proyek lain selesai), serial, dan memulihkan data di afterAll.
test.describe.configure({ mode: 'serial' });

const PW = 'sandi-admin-artikel-mutasi-1';
const PREFIXES = ['Tes Artikel', 'Tes Publik'];
const SEEDED_SLUGS = ['sepakati-5-hal-sebelum-gathering-kantor', 'offroad-atau-pantai-kenali-selera-timmu', 'itinerary-enak-tidak-harus-padat-acara'];
type Original = { slug: string; published: number; featured: number };
let original: Original[] = [];
let admin = '';

function restore() {
	for (const p of PREFIXES) cleanupArticles(p);
	for (const a of original) exec('UPDATE article SET published = ?, featured = ? WHERE slug = ?', a.published, a.featured, a.slug);
}
test.beforeAll(() => {
	for (const p of PREFIXES) cleanupArticles(p);
	original = query<Original>('SELECT slug, published, featured FROM article WHERE slug IN (?, ?, ?)', ...SEEDED_SLUGS);
	admin = uniqueLogin('artikel-mutasi');
	insertAdmin(admin, PW);
});
test.afterAll(restore);

const rowOf = (page: Page, slug: string) => page.locator(`li[data-article="${slug}"]`);
const click = (page: Page, slug: string, name: string) => submit(page, () => rowOf(page, slug).getByRole('button', { name, exact: true }).click());
const popularTitles = async (page: Page) => (await page.locator('#artikel-populer h3').allInnerTexts()).map((t) => t.trim());
const status = (request: Page['request'], slug: string) => request.get(`/artikel/${slug}`).then((r) => r.status());

test.describe('[article-cms] Terbitkan dan sembunyikan', () => {
	test('menerbitkan draf: tampil di /artikel dan dapat dibuka; published_at tetap saat disembunyikan lalu diterbitkan lagi', async ({ page, request }) => {
		const title = uniqueTitle('Tes Artikel Terbit');
		const row = insertArticle(title, { body: 'Isi yang akan terbit.' });
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/artikel');
		await expect(page.getByText(title)).toHaveCount(0);
		expect(await status(request, row.slug)).toBe(404);

		await gotoReady(page, '/admin/artikel');
		await click(page, row.slug, 'Terbitkan');
		await expect(page.getByRole('status')).toContainText('diterbitkan');
		await expect(rowOf(page, row.slug)).toContainText('Terbit');
		const firstAt = articleById(row.id).published_at;
		expect(firstAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

		await gotoReady(page, '/artikel');
		await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible();
		expect(await status(request, row.slug)).toBe(200);

		await gotoReady(page, '/admin/artikel');
		await click(page, row.slug, 'Sembunyikan');
		await expect(page.getByRole('status')).toContainText('disembunyikan');
		expect(await status(request, row.slug)).toBe(404);
		await gotoReady(page, '/artikel');
		await expect(page.getByText(title)).toHaveCount(0);

		await gotoReady(page, '/admin/artikel');
		await click(page, row.slug, 'Terbitkan');
		expect(articleById(row.id).published_at).toBe(firstAt);
	});

	test('centang "Tampilkan di situs" pada form ubah menerbitkan artikel', async ({ page, request }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel Form'), { body: 'Isi.' });
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/artikel/${row.id}`);
		await page.getByLabel('Tampilkan di situs').check();
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(articleById(row.id)).toMatchObject({ published: 1 });
		expect(articleById(row.id).published_at).not.toBeNull();
		expect(await status(request, row.slug)).toBe(200);
	});
});

test.describe('[article-cms] Artikel populer', () => {
	test('menandai artikel terbit baru sebagai populer memunculkannya di beranda; melepas menggantinya', async ({ page }) => {
		const title = uniqueTitle('Tes Artikel Populer');
		const row = insertArticle(title, { published: 1, published_at: '2026-12-01T00:00:00.000Z' });
		await adminLogin(page, admin, PW);
		// Semua artikel bawaan populer; artikel baru yang tidak populer tidak masuk tiga teratas.
		await gotoReady(page, '/');
		expect(await popularTitles(page)).toHaveLength(3);
		await expect(page.locator('#artikel-populer').getByText(title)).toHaveCount(0);

		await gotoReady(page, '/admin/artikel');
		await click(page, row.slug, 'Jadikan populer');
		await expect(page.getByRole('status')).toContainText('ditandai populer');
		await expect(rowOf(page, row.slug)).toContainText('Populer');
		await gotoReady(page, '/');
		const withIt = await popularTitles(page);
		expect(withIt).toHaveLength(3);
		expect(withIt[0]).toBe(title);
		// Artikel tanpa sampul: kartu tetap memuat gambar (bawaan), bukan ruang kosong.
		await expect(page.locator('#artikel-populer a[href^="/artikel/"]').first().locator('img')).toHaveAttribute('src', '/media/forest.svg');
		// Sampul foto Unsplash tampil pada kartu beranda: hotlink 600 px dengan ixid.
		exec('UPDATE article SET cover_image = ?, cover_credit_name = ?, cover_unsplash_id = ? WHERE id = ?', 'https://images.unsplash.com/photo-fotouji20?ixlib=rb-4.1.0&ixid=IDfotouji20', 'Ana', 'fotouji20', row.id);
		await gotoReady(page, '/');
		const cardSrc = new URL((await page.locator('#artikel-populer a[href^="/artikel/"]').first().locator('img').getAttribute('src'))!);
		expect([cardSrc.origin, cardSrc.searchParams.get('w'), cardSrc.searchParams.get('ixid')]).toEqual(['https://images.unsplash.com', '600', 'IDfotouji20']);

		await gotoReady(page, '/admin/artikel');
		await click(page, row.slug, 'Lepas populer');
		await gotoReady(page, '/');
		expect(await popularTitles(page)).not.toContain(title);
	});

	test('tanpa unggulan, beranda diisi artikel terbit terbaru; draf unggulan tidak ikut', async ({ page }) => {
		exec('UPDATE article SET featured = 0 WHERE slug IN (?, ?, ?)', ...SEEDED_SLUGS);
		const newest = insertArticle(uniqueTitle('Tes Artikel Terbaru'), { published: 1, published_at: '2027-01-01T00:00:00.000Z' });
		insertArticle(uniqueTitle('Tes Artikel DrafUnggulan'), { featured: 1, published: 0 });
		await gotoReady(page, '/');
		const titles = await popularTitles(page);
		expect(titles).toHaveLength(3);
		expect(titles[0]).toBe(newest.title);
		expect(titles.join('|')).not.toContain('DrafUnggulan');
		exec('UPDATE article SET featured = 1 WHERE slug IN (?, ?, ?)', ...SEEDED_SLUGS);
	});

	test('tanpa artikel terbit, section #artikel-populer tidak dirender dan /artikel menampilkan keterangan', async ({ page }) => {
		exec('UPDATE article SET published = 0 WHERE published = 1');
		try {
			await gotoReady(page, '/');
			await expect(page.locator('#artikel-populer')).toHaveCount(0);
			expect(await page.$$eval('main > section[id]', (s) => s.map((x) => x.id))).toEqual(['katalog', 'paket', 'konsultasi', 'rencanakan']);
			const res = await page.goto('/artikel');
			expect(res?.status()).toBe(200);
			await expect(page.getByText('Artikel segera hadir')).toBeVisible();
		} finally {
			restore();
		}
	});
});

test.describe('[article-cms] Sampul artikel', () => {
	test('unggah, ganti, dan hapus sampul; berkas lama terhapus dan tampil di halaman artikel', async ({ page, request }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel Sampul'), { published: 1 });
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		await page.getByLabel(/^Unggah foto/).setInputFiles(file('a.png', PNG, 'image/png'));
		await fillArticle(page, { cover_alt: 'Foto uji sampul' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		const first = articleById(row.id).cover_image!;
		expect(first).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
		expect(existsSync(join(UPLOAD_DIR, first.slice('/uploads/'.length)))).toBe(true);
		expect((await request.get(first)).status()).toBe(200);

		await gotoReady(page, `/artikel/${row.slug}`);
		await expect(page.locator('article img')).toHaveAttribute('src', first);
		await expect(page.locator('article img')).toHaveAttribute('alt', 'Foto uji sampul');

		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		await page.getByLabel(/^Ganti foto/).setInputFiles(file('b.jpg', JPEG, 'image/jpeg'));
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		const second = articleById(row.id).cover_image!;
		expect(second).toMatch(/\.jpg$/);
		expect(existsSync(join(UPLOAD_DIR, first.slice('/uploads/'.length)))).toBe(false);

		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		await page.getByLabel('Hapus foto ini').check();
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(articleById(row.id).cover_image).toBeNull();
		expect(existsSync(join(UPLOAD_DIR, second.slice('/uploads/'.length)))).toBe(false);
		await gotoReady(page, `/artikel/${row.slug}`);
		await expect(page.locator('article img')).toHaveAttribute('src', '/media/forest.svg');
	});

	test('berkas teks bernama foto.png ditolak tanpa mengubah artikel dan tanpa berkas baru', async ({ page }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel Tolak'));
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		await page.getByLabel(/^Unggah foto/).setInputFiles(file('foto.png', Buffer.from('bukan gambar'), 'image/png'));
		await fillArticle(page, { title: 'Judul Tidak Boleh Berubah' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(await alerts(page)).toEqual(['Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.']);
		expect(articleById(row.id)).toMatchObject({ title: row.title, cover_image: null });
	});

	test('menghapus artikel bersampul unggahan menghapus berkasnya', async ({ page }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel HapusSampul'));
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		await page.getByLabel(/^Unggah foto/).setInputFiles(file('a.png', PNG, 'image/png'));
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		const cover = articleById(row.id).cover_image!;
		const path = join(UPLOAD_DIR, cover.slice('/uploads/'.length));
		expect(existsSync(path)).toBe(true);
		await gotoReady(page, '/admin/artikel');
		page.once('dialog', (d) => d.accept());
		await submit(page, () => rowOf(page, row.slug).getByRole('button', { name: 'Hapus', exact: true }).click());
		expect(existsSync(path)).toBe(false);
		expect(articleByTitle(row.title)).toBeUndefined();
	});
});

test.describe('[article-pages] Render markdown yang aman', () => {
	test('subjudul dan daftar dirender; HTML mentah, tautan javascript:, dan gambar tidak berbahaya', async ({ page }) => {
		const title = uniqueTitle('Tes Artikel Markdown');
		const body = [
			'# Judul Dalam Isi',
			'Paragraf dengan **tebal** dan [tautan luar](https://example.com).',
			'### Sub',
			'- satu\n- dua',
			'<script>window.__xss = 1</script>',
			'<img src=x onerror="window.__xss = 2">',
			'[jahat](javascript:window.__xss=3)',
			'![gambar](https://example.com/x.png)'
		].join('\n\n');
		const row = insertArticle(title, { published: 1, body });
		await gotoReady(page, `/artikel/${row.slug}`);
		const content = page.locator('.article-body');
		await expect(content.locator('h2')).toHaveText('Judul Dalam Isi');
		await expect(content.locator('h3')).toHaveText('Sub');
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		await expect(content.locator('li')).toHaveCount(2);
		await expect(content.locator('strong')).toHaveText('tebal');
		const ext = content.getByRole('link', { name: 'tautan luar' });
		await expect(ext).toHaveAttribute('rel', 'noopener noreferrer');
		await expect(ext).toHaveAttribute('target', '_blank');
		await expect(content.locator('script, img, [onerror]')).toHaveCount(0);
		await expect(content.locator('a[href^="javascript:" i]')).toHaveCount(0);
		await expect(content).toContainText('<script>window.__xss = 1</script>');
		expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
		await page.evaluate(() => document.querySelectorAll('.article-body a').forEach((a) => (a as HTMLAnchorElement).click?.()));
		expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
	});

	test('markdown yang diketik lewat CMS tersimpan apa adanya dan tampil setelah diterbitkan', async ({ page }) => {
		const title = uniqueTitle('Tes Artikel DariForm');
		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/artikel/baru');
		await noClientValidation(page);
		await fillArticle(page, { title, category: 'UJI', excerpt: 'Ringkas.', body: '## Bagian Satu\n\nIsi bagian satu.' });
		await submit(page, () => page.getByRole('button', { name: 'Simpan sebagai draf' }).click());
		await page.getByLabel('Tampilkan di situs').check();
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		await gotoReady(page, `/artikel/${slugOf(title)}`);
		await expect(page.locator('.article-body h2')).toHaveText('Bagian Satu');
		await expect(page).toHaveTitle(`${title} | Lembang Adventures`);
	});
});

test.describe('[sitemap-feeds] Sitemap dan feed mengikuti CMS', () => {
	const inSitemap = async (request: Page['request'], slug: string) => (await (await request.get('/sitemap.xml')).text()).includes(`/artikel/${slug}</loc>`);
	const inFeed = async (request: Page['request'], slug: string) => (await (await request.get('/artikel/rss.xml')).text()).includes(`/artikel/${slug}</link>`);

	test('menerbitkan menambah artikel ke sitemap dan RSS; menyembunyikan menghapusnya', async ({ page, request }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel Sitemap'), { body: 'Isi.' });
		expect(await inSitemap(request, row.slug)).toBe(false);
		expect(await inFeed(request, row.slug)).toBe(false);

		await adminLogin(page, admin, PW);
		await gotoReady(page, '/admin/artikel');
		await click(page, row.slug, 'Terbitkan');
		expect(await inSitemap(request, row.slug)).toBe(true);
		expect(await inFeed(request, row.slug)).toBe(true);
		const lastmod = (await (await request.get('/sitemap.xml')).text()).match(new RegExp(`/artikel/${row.slug}</loc><lastmod>([^<]+)</lastmod>`));
		expect(lastmod?.[1]).toMatch(/^\d{4}-\d{2}-\d{2}T/);

		await gotoReady(page, '/admin/artikel');
		await click(page, row.slug, 'Sembunyikan');
		expect(await inSitemap(request, row.slug)).toBe(false);
		expect(await inFeed(request, row.slug)).toBe(false);
	});
});

test.describe('[seo-metadata] Gambar bagikan artikel', () => {
	test('sampul unggahan menjadi og:image dan twitter:image absolut; sampul AVIF memakai gambar bawaan', async ({ page }) => {
		const cover = '/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c.jpg';
		const row = insertArticle(uniqueTitle('Tes Artikel OgSampul'), { published: 1, cover_image: cover });
		await gotoReady(page, `/artikel/${row.slug}`);
		const abs = new RegExp(`^http://127\\.0\\.0\\.1:\\d+${cover.replace('.', '\\.')}$`);
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', abs);
		await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', abs);
		await expect(page.locator('meta[property="og:image:width"]')).toHaveCount(0);
		const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
		expect(ld['@graph'][0].image[0]).toMatch(abs);

		const avif = insertArticle(uniqueTitle('Tes Artikel OgAvif'), { published: 1, cover_image: '/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7d.avif' });
		await gotoReady(page, `/artikel/${avif.slug}`);
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-default\.png$/);
	});

	test('judul berbahaya tidak menutup script JSON-LD dan tetap terbaca utuh', async ({ page }) => {
		const evil = 'Tes Artikel </script><script>window.__ld=1</script> Judul';
		const row = insertArticle(evil, { published: 1 });
		await gotoReady(page, `/artikel/${row.slug}`);
		await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
		const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
		expect(ld['@graph'][0].headline).toBe(evil);
		expect(await page.evaluate(() => (window as unknown as { __ld?: number }).__ld)).toBeUndefined();
	});
});

test.describe('[unsplash-picker] Satu sumber sampul dan tampilan publik', () => {
	const photoUrl = (id: string) => `https://images.unsplash.com/photo-${id}?ixlib=rb-4.1.0&ixid=ID${id}`;

	test('foto Unsplash menggantikan unggahan: berkas lama terhapus; unggahan menggantikan Unsplash: kredit dikosongkan', async ({ page }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel GantiSumber'));
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		await page.getByLabel(/^Unggah foto/).setInputFiles(file('a.png', PNG, 'image/png'));
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		const upload = articleById(row.id).cover_image!;
		const path = join(UPLOAD_DIR, upload.slice('/uploads/'.length));
		expect(existsSync(path)).toBe(true);

		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		const id = await pickPhoto(page, uniqueQuery('ganti'), 2);
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(articleById(row.id).cover_image).toBe(photoUrl(id));
		expect(existsSync(path)).toBe(false);

		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		await page.getByLabel(/^Ganti foto/).setInputFiles(file('b.jpg', JPEG, 'image/jpeg'));
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		const after = query<{ cover_image: string; cover_credit_name: string | null; cover_unsplash_id: string | null }>(
			'SELECT cover_image, cover_credit_name, cover_unsplash_id FROM article WHERE id = ?', row.id
		)[0];
		expect(after.cover_image).toMatch(/^\/uploads\/.+\.jpg$/);
		expect(after.cover_credit_name).toBeNull();
		expect(after.cover_unsplash_id).toBeNull();
	});

	test('halaman artikel: gambar hotlink berukuran, atribusi ber-UTM, dan og:image Unsplash 1200x630', async ({ page }) => {
		const title = uniqueTitle('Tes Artikel TampilUnsplash');
		const row = insertArticle(title, { published: 1 });
		const id = 'fotouji12';
		exec(
			'UPDATE article SET cover_image = ?, cover_credit_name = ?, cover_credit_url = ?, cover_unsplash_id = ? WHERE id = ?',
			photoUrl(id), 'Ana Budi', 'https://unsplash.com/@anabudi', id, row.id
		);
		await gotoReady(page, `/artikel/${row.slug}`);
		const img = page.locator('article figure img');
		const src = new URL((await img.getAttribute('src'))!);
		expect(src.origin).toBe('https://images.unsplash.com');
		expect(src.searchParams.get('w')).toBe('1200');
		expect(src.searchParams.get('ixid')).toBe(`ID${id}`);
		const caption = page.locator('article figcaption');
		await expect(caption).toContainText('Foto oleh Ana Budi di Unsplash');
		const profile = caption.getByRole('link', { name: 'Ana Budi' });
		await expect(profile).toHaveAttribute('href', 'https://unsplash.com/@anabudi?utm_source=lembang_adventures&utm_medium=referral');
		await expect(profile).toHaveAttribute('rel', 'noopener noreferrer');
		await expect(caption.getByRole('link', { name: 'Unsplash' })).toHaveAttribute('href', 'https://unsplash.com/?utm_source=lembang_adventures&utm_medium=referral');

		const og = new URL((await page.locator('meta[property="og:image"]').getAttribute('content'))!);
		expect(og.origin).toBe('https://images.unsplash.com');
		expect([og.searchParams.get('w'), og.searchParams.get('h'), og.searchParams.get('ixid')]).toEqual(['1200', '630', `ID${id}`]);
		await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', og.toString());
		const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
		expect(ld['@graph'][0].image[0]).toBe(og.toString());

		await gotoReady(page, '/artikel');
		const card = page.locator(`a[href="/artikel/${row.slug}"] img`);
		const cardSrc = new URL((await card.getAttribute('src'))!);
		expect([cardSrc.origin, cardSrc.searchParams.get('w')]).toEqual(['https://images.unsplash.com', '600']);
	});

	test('foto Unsplash yang gagal dimuat diganti gambar bawaan', async ({ page }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel FotoHilang'), { published: 1 });
		exec('UPDATE article SET cover_image = ?, cover_credit_name = ?, cover_unsplash_id = ? WHERE id = ?', photoUrl('fotouji13'), 'Ana', 'fotouji13', row.id);
		await page.route('https://images.unsplash.com/**', (route) => route.abort());
		await gotoReady(page, `/artikel/${row.slug}`);
		await expect(page.locator('article figure img')).toHaveAttribute('src', '/media/forest.svg');
	});

	test('URL gambar dari host lain tidak pernah dirender: gambar bawaan dan tanpa atribusi', async ({ page }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel HostAsing'), { published: 1, cover_image: 'https://evil.example/x.jpg' });
		await gotoReady(page, `/artikel/${row.slug}`);
		await expect(page.locator('article figure img')).toHaveAttribute('src', '/media/forest.svg');
		await expect(page.locator('article figcaption')).toHaveCount(0);
		// Nilai mentah masih ada di data hidrasi SvelteKit (JSON), tetapi tidak boleh dirujuk elemen atau meta mana pun.
		await expect(page.locator('[src*="evil.example"], [href*="evil.example"], [content*="evil.example"], [style*="evil.example"]')).toHaveCount(0);
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-default\.png$/);
	});

	test('pemilihan lewat CMS pada artikel terbit: simpan memicu unduhan dan halaman publik menampilkan kredit', async ({ page }) => {
		const row = insertArticle(uniqueTitle('Tes Artikel PilihTerbit'), { published: 1 });
		await adminLogin(page, admin, PW);
		await gotoReady(page, `/admin/artikel/${row.id}`);
		await noClientValidation(page);
		const id = await pickPhoto(page, uniqueQuery('terbit'), 4);
		const before = await downloadCalls(id);
		await submit(page, () => page.getByRole('button', { name: 'Simpan perubahan' }).click());
		expect(await downloadCalls(id)).toBe(before + 1);
		await gotoReady(page, `/artikel/${row.slug}`);
		await expect(page.locator('article figcaption')).toContainText(`Foto oleh Fotografer ${id} di Unsplash`);
	});
});
