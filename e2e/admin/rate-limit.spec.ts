import { insertAdmin, uniqueLogin } from '../support/admin';
import { expect, test } from '../support/fixtures';

const PW = 'sandi-uji-limit-1';

test.describe('[admin-auth] Pembatasan percobaan login', () => {
	test('lima kegagalan lalu percobaan keenam (password benar) → 429 + Retry-After, tanpa cookie', async ({ request, baseURL }) => {
		const login = uniqueLogin('lock');
		insertAdmin(login, PW);
		const headers = { origin: new URL(baseURL!).origin };
		const post = (l: string, password: string) => request.post('/admin/login', { form: { login: l, password }, headers, maxRedirects: 0 });

		for (let i = 1; i <= 5; i++) {
			const res = await post(login, `salah-${i}-xyz`);
			expect(res.status(), `kegagalan ke-${i}`).toBe(400);
		}
		const locked = await post(login, PW);
		expect(locked.status()).toBe(429);
		const retry = Number(locked.headers()['retry-after']);
		expect(retry).toBeGreaterThan(0);
		expect(retry).toBeLessThanOrEqual(900);
		expect(await locked.text()).toContain('Terlalu banyak percobaan');
		expect(locked.headers()['set-cookie'] ?? '').not.toContain('session=');
	});

	test('login lain dari IP yang sama tetap diproses', async ({ playwright, baseURL }) => {
		const locked = uniqueLogin('lock2');
		const other = uniqueLogin('bebas');
		insertAdmin(locked, PW);
		insertAdmin(other, PW);
		// Konteks request baru per tahap: cookie sesi dari login berhasil membuat penjaga mengalihkan POST berikutnya.
		const api = () => playwright.request.newContext({ baseURL: baseURL!, extraHTTPHeaders: { 'X-Forwarded-Proto': 'http' } });
		const headers = { origin: new URL(baseURL!).origin };
		const post = (ctx: Awaited<ReturnType<typeof api>>, l: string, password: string) =>
			ctx.post('/admin/login', { form: { login: l, password }, headers, maxRedirects: 0 });

		const a = await api();
		for (let i = 0; i < 5; i++) await post(a, locked, `salah-${i}-xyz`);
		expect((await post(a, locked, PW)).status()).toBe(429);
		expect((await post(a, uniqueLogin('hantu'), 'salah-0-xyz')).status(), 'login tak dikenal tetap diproses').toBe(400);
		const ok = await post(a, other, PW);
		expect(ok.status()).not.toBe(429);
		expect(ok.headers()['set-cookie'] ?? '').toContain('session=');
		await a.dispose();
	});

	test('empat kegagalan lalu berhasil mereset hitungan', async ({ playwright, baseURL }) => {
		const login = uniqueLogin('reset');
		insertAdmin(login, PW);
		const api = () => playwright.request.newContext({ baseURL: baseURL!, extraHTTPHeaders: { 'X-Forwarded-Proto': 'http' } });
		const headers = { origin: new URL(baseURL!).origin };
		const post = (ctx: Awaited<ReturnType<typeof api>>, password: string) =>
			ctx.post('/admin/login', { form: { login, password }, headers, maxRedirects: 0 });

		const first = await api();
		for (let i = 0; i < 4; i++) expect((await post(first, `salah-${i}-xyz`)).status()).toBe(400);
		expect((await post(first, PW)).headers()['set-cookie'] ?? '').toContain('session=');
		await first.dispose();

		const second = await api(); // tanpa cookie sesi
		for (let i = 0; i < 4; i++) expect((await post(second, `salah-${i}-abc`)).status()).toBe(400);
		expect((await post(second, PW)).status(), 'belum terkunci karena hitungan direset').not.toBe(429);
		await second.dispose();
	});
});
