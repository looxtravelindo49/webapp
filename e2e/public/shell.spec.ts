import { expect, gotoReady, test } from '../support/fixtures';

const top = (page: import('@playwright/test').Page, selector: string) =>
	page.locator(selector).evaluate((e) => e.getBoundingClientRect().top);
const navHeight = async (page: import('@playwright/test').Page) => (await page.locator('header').first().boundingBox())!.height;

test.describe('[e2e-testing] Penanda hidrasi', () => {
	test('terpasang setelah hidrasi dan tidak ada pada HTML respons server', async ({ page, request }) => {
		const html = await (await request.get('/')).text();
		expect(html).not.toMatch(/<html[^>]*data-hydrated/);
		await gotoReady(page, '/');
		await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
	});
});

test.describe('[site-shell] Urutan section beranda', () => {
	test('paket → konsultasi → destinasi → rencanakan → inspirasi, diapit Navbar dan Footer', async ({ page }) => {
		await gotoReady(page, '/');
		const ids = await page.$$eval('main > section[id]', (s) => s.map((x) => x.id));
		expect(ids).toEqual(['paket', 'konsultasi', 'destinasi', 'rencanakan', 'inspirasi']);
		await expect(page.locator('header').first()).toBeVisible();
		await expect(page.locator('footer')).toHaveCount(1);
		await expect(page.getByRole('heading', { level: 1 })).toContainText('Bawa timmu');
	});
});

test.describe('[site-shell] Navbar', () => {
	test('tautan anchor menggulir tanpa tertutup Navbar sticky', async ({ page }) => {
		await gotoReady(page, '/');
		for (const [label, id] of [['Pilihan Paket', 'paket'], ['Destinasi', 'destinasi'], ['Inspirasi Trip', 'inspirasi'], ['Rencanakan Trip', 'rencanakan']] as const) {
			await page.locator('header nav').getByRole('link', { name: label }).click();
			const nh = await navHeight(page);
			// Tidak tertutup Navbar, dan terlihat di viewport (section di dasar halaman tidak bisa digulir sampai paling atas).
			await expect.poll(() => top(page, `#${id}`), { message: `#${id} di bawah navbar` }).toBeGreaterThanOrEqual(nh - 2);
			await expect.poll(() => top(page, `#${id}`)).toBeLessThan((page.viewportSize()?.height ?? 720) - 100);
		}
	});

	test('menu mobile 375px: buka, aria-expanded akurat, menutup setelah memilih tautan', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });
		await gotoReady(page, '/');
		const toggle = page.locator('header button[aria-controls]');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
		await expect(page.locator('header nav').getByRole('link', { name: 'Destinasi' })).toBeHidden();
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		const controls = await toggle.getAttribute('aria-controls');
		await expect(page.locator(`#${controls}`)).toBeVisible();
		await page.locator('header nav').getByRole('link', { name: 'Destinasi' }).click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});

	test('Esc menutup menu mobile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 800 });
		await gotoReady(page, '/');
		const toggle = page.locator('header button[aria-controls]');
		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-expanded', 'true');
		await page.keyboard.press('Escape');
		await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});
});

test.describe('[site-shell] Tombol konsultasi menuju #konsultasi', () => {
	const cases: [string, (p: import('@playwright/test').Page) => Promise<void>][] = [
		['Navbar "Konsultasi Trip"', (p) => p.locator('header').getByRole('link', { name: 'Konsultasi Trip' }).and(p.locator(':visible')).click()],
		['Hero "Diskusi dulu, yuk"', (p) => p.getByRole('link', { name: 'Diskusi dulu, yuk' }).click()],
		['Planner "Mulai rencanakan"', (p) => p.locator('#rencanakan').getByRole('link', { name: 'Mulai rencanakan' }).click()]
	];
	for (const [name, act] of cases) {
		test(`${name} menggulir ke #konsultasi di bawah Navbar`, async ({ page }) => {
			await gotoReady(page, '/');
			await act(page);
			const nh = await navHeight(page);
			await expect.poll(() => top(page, '#konsultasi')).toBeGreaterThanOrEqual(nh - 2);
			await expect.poll(() => top(page, '#konsultasi')).toBeLessThan(200);
		});
	}

	test('Hero: tombol utama "Temukan ide trip" menuju #paket', async ({ page }) => {
		await gotoReady(page, '/');
		await page.getByRole('link', { name: 'Temukan ide trip' }).click();
		const nh = await navHeight(page);
		await expect.poll(() => top(page, '#paket')).toBeGreaterThanOrEqual(nh - 2);
		await expect.poll(() => top(page, '#paket')).toBeLessThan(200);
	});
});

test.describe('[site-shell] Aksesibilitas dasar', () => {
	test('skip link adalah fokus pertama dan memindahkan fokus ke konten utama', async ({ page }) => {
		await gotoReady(page, '/');
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'Langsung ke isi' })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('main#main')).toBeFocused();
	});

	test('lang="id" dan indikator fokus terlihat', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page.locator('html')).toHaveAttribute('lang', 'id');
		await page.getByRole('link', { name: 'Temukan ide trip' }).focus();
		const outline = await page.evaluate(() => {
			const s = getComputedStyle(document.activeElement!);
			return `${s.outlineStyle} ${s.outlineWidth}`;
		});
		expect(outline).toMatch(/solid 3px/);
	});
});

test.describe('[site-shell] SEO dasar', () => {
	test('title, description, canonical, Open Graph, dan JSON-LD Organization', async ({ page }) => {
		await gotoReady(page, '/');
		await expect(page).toHaveTitle(/Lembang Adventures/);
		await expect(page.locator('meta[name=description]')).toHaveAttribute('content', /.{40,}/);
		await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /^http:\/\/127\.0\.0\.1:\d+\/$/);
		await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
		const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
		expect(ld['@type']).toBe('Organization');
	});

	test('robots.txt melarang /admin/ dan menunjuk sitemap; sitemap memuat beranda', async ({ request }) => {
		const robots = await (await request.get('/robots.txt')).text();
		expect(robots).toContain('Disallow: /admin/');
		expect(robots).toMatch(/Sitemap: http:\/\/127\.0\.0\.1:\d+\/sitemap\.xml/);
		const sitemap = await (await request.get('/sitemap.xml')).text();
		expect(sitemap).toMatch(/<loc>http:\/\/127\.0\.0\.1:\d+\/<\/loc>/);
	});

	test('/healthz sehat', async ({ request }) => {
		const res = await request.get('/healthz');
		expect(res.status()).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	test('situs publik tanpa header khusus area admin', async ({ request }) => {
		const res = await request.get('/');
		expect(res.headers()['x-robots-tag'] ?? '').not.toContain('noindex');
		expect(res.headers()['x-frame-options']).toBeUndefined();
	});
});
