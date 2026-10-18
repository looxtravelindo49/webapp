import { adminLogin, path } from '../support/admin-ui';
import { insertAdmin, uniqueLogin } from '../support/admin';
import { query } from '../support/db';
import { expect, gotoReady, test } from '../support/fixtures';

const PW = 'sandi-uji-security-1';
const HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-frame-options': 'DENY' };
const expectSecurityHeaders = (headers: Record<string, string>) => {
	for (const [k, v] of Object.entries(HEADERS)) expect(headers[k], k).toBe(v);
};

test.describe('[admin-auth] Perlindungan rute admin', () => {
	for (const url of ['/admin', '/admin/', '/admin/akun', '/admin/akun/', '/admin/ganti-password', '/admin/paket-apa-saja']) {
		test(`GET ${url} tanpa sesi → 303 /admin/login dengan header keamanan`, async ({ request }) => {
			const res = await request.get(url, { maxRedirects: 0 });
			expect(res.status()).toBe(303);
			expect(res.headers().location).toBe('/admin/login');
			expectSecurityHeaders(res.headers());
		});
	}

	test('POST aksi tanpa sesi tidak dijalankan (tidak ada akun baru)', async ({ request, baseURL }) => {
		const login = uniqueLogin('penyusup');
		const res = await request.post('/admin/akun?/buat', {
			form: { login, password: 'penyusup-123' },
			headers: { origin: new URL(baseURL!).origin },
			maxRedirects: 0
		});
		expect(res.status()).toBe(303);
		expect(query('SELECT id FROM user WHERE login = ?', login)).toHaveLength(0);
	});

	test('situs publik tidak terpengaruh penjaga', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Bawa timmu');
	});
});

test.describe('[admin-auth] Pemeriksaan asal (CSRF) pada build produksi', () => {
	test('POST form dari asal lain ditolak (403)', async ({ request }) => {
		const res = await request.post('/admin/login', { form: { login: 'x', password: 'y' }, headers: { origin: 'https://evil.example' }, maxRedirects: 0 });
		expect(res.status()).toBe(403);
	});

	test('POST form tanpa header Origin ditolak (403)', async ({ request }) => {
		const res = await request.post('/admin/login', { form: { login: 'x', password: 'y' }, headers: { origin: '' }, maxRedirects: 0 });
		expect(res.status()).toBe(403);
	});
});

test.describe('[admin-auth] Header keamanan area admin', () => {
	test('ada pada halaman login (juga dengan garis miring akhir)', async ({ request }) => {
		for (const url of ['/admin/login', '/admin/login/']) {
			const res = await request.get(url);
			expect(res.status(), url).toBe(200);
			expectSecurityHeaders(res.headers());
		}
	});

	test('ada pada halaman 404 di dalam /admin untuk pengguna login, dan pada halaman admin biasa', async ({ page }) => {
		const login = uniqueLogin('hdr');
		insertAdmin(login, PW);
		await adminLogin(page, login, PW);
		for (const [url, status] of [['/admin/tidak-ada-halaman', 404], ['/admin', 200], ['/admin/akun', 200]] as const) {
			const res = await page.request.get(url);
			expect(res.status(), url).toBe(status);
			expectSecurityHeaders(res.headers());
		}
	});

	test('situs publik tidak memuat header khusus admin', async ({ request }) => {
		const res = await request.get('/');
		expect(res.headers()['x-robots-tag'] ?? '').not.toContain('noindex');
		expect(res.headers()['x-frame-options']).toBeUndefined();
		expect(res.headers()['cache-control'] ?? '').not.toBe('no-store');
	});
});

test.describe('[admin-auth] Cookie sesi mengikuti protokol', () => {
	test('tanpa Secure di HTTP, dengan Secure bila permintaan HTTPS (di balik proxy TLS)', async ({ request, playwright, baseURL }) => {
		const login = uniqueLogin('sec');
		insertAdmin(login, PW);
		const origin = new URL(baseURL!).origin;
		const http = await request.post('/admin/login', { form: { login, password: PW }, headers: { origin }, maxRedirects: 0 });
		const cookieHttp = http.headers()['set-cookie'] ?? '';
		expect(cookieHttp).toContain('session=');
		expect(cookieHttp).toMatch(/HttpOnly/i);
		expect(cookieHttp).toMatch(/SameSite=Lax/i);
		expect(cookieHttp).not.toMatch(/;\s*Secure/i);

		// Konteks request baru tanpa X-Forwarded-Proto bawaan konfigurasi, agar hanya header 'https' yang terkirim.
		const tls = await playwright.request.newContext({ baseURL: baseURL!, extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
		const https = await tls.post('/admin/login', {
			form: { login, password: PW },
			headers: { origin: origin.replace('http:', 'https:') },
			maxRedirects: 0
		});
		// Untuk permintaan non-HTML, SvelteKit membalas JSON {type:'redirect'} berstatus 200.
		expect((await https.json()).type).toBe('redirect');
		expect(https.headers()['set-cookie'] ?? '').toMatch(/;\s*Secure/i);
		await tls.dispose();
	});
});

test.describe('[admin-auth] Shell admin terpisah dari situs publik', () => {
	test('tanpa Navbar/Footer publik; memuat navigasi admin, nama login, Keluar, dan meta noindex', async ({ page }) => {
		const login = uniqueLogin('shell');
		insertAdmin(login, PW);
		await adminLogin(page, login, PW);
		expect(path(page)).toBe('/admin');
		await expect(page.getByText('Pilihan Paket')).toHaveCount(0);
		await expect(page.locator('footer')).toHaveCount(0);
		await expect(page.getByRole('link', { name: /Konsultasi Trip/ })).toHaveCount(0);
		const nav = page.getByRole('navigation', { name: 'Navigasi admin' });
		expect((await nav.getByRole('link').allInnerTexts()).map((t) => t.trim())).toEqual([
			'Beranda',
			'Paket',
			'Pengaturan',
			'Akun',
			'Lihat situs ↗'
		]);
		for (const [name, href] of [['Beranda', '/admin'], ['Paket', '/admin/paket'], ['Pengaturan', '/admin/pengaturan'], ['Akun', '/admin/akun']] as const) {
			await expect(nav.getByRole('link', { name })).toHaveAttribute('href', href);
		}
		await expect(page.getByText(login)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible();
		await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
	});

	test('beranda publik tetap memuat Navbar, Hero, dan Footer', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.getByRole('link', { name: 'Pilihan Paket' })).toBeVisible();
		await expect(page.locator('footer')).toHaveCount(1);
	});
});
