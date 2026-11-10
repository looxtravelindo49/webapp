import type { Page } from '@playwright/test';
import { insertArticle, uniqueTitle } from '../support/articles';
import { WA_NUMBER } from '../support/env';
import { expect, gotoReady, test } from '../support/fixtures';

const ORIGIN = /^http:\/\/127\.0\.0\.1:\d+/;
const SEEDED = [
	'sepakati-5-hal-sebelum-gathering-kantor',
	'offroad-atau-pantai-kenali-selera-timmu',
	'itinerary-enak-tidak-harus-padat-acara'
];
const ARTICLE = `/artikel/${SEEDED[0]}`;

const content = (page: Page, selector: string) => page.locator(selector).getAttribute('content');
type Node = Record<string, unknown> & { '@type': string };
async function graph(page: Page): Promise<Node[]> {
	// Tepat satu blok JSON-LD per halaman publik.
	const scripts = page.locator('script[type="application/ld+json"]');
	const count = await scripts.count();
	expect(count).toBe(1);
	const nodes: Node[] = [];
	for (let i = 0; i < count; i++) {
		const ld = JSON.parse((await scripts.nth(i).textContent())!);
		expect(ld['@context']).toBe('https://schema.org');
		nodes.push(...ld['@graph']);
	}
	return nodes;
}
const node = (nodes: Node[], type: string) => nodes.find((n) => n['@type'] === type)!;
const typesExceptBusiness = (nodes: Node[]) => nodes.map((n) => n['@type']).filter((t) => t !== 'TravelAgency');
/** Satu node bisnis bertipe TravelAgency, tanpa node Organization terpisah. */
function business(nodes: Node[]): Node {
	expect(nodes.filter((n) => n['@type'] === 'TravelAgency')).toHaveLength(1);
	expect(nodes.some((n) => n['@type'] === 'Organization')).toBe(false);
	return node(nodes, 'TravelAgency');
}

async function expectSingleTags(page: Page) {
	for (const sel of [
		'link[rel=canonical]', 'meta[name=description]', 'meta[property="og:title"]', 'meta[property="og:description"]',
		'meta[property="og:url"]', 'meta[property="og:type"]', 'meta[property="og:site_name"]', 'meta[property="og:locale"]',
		'meta[property="og:image"]', 'meta[property="og:image:alt"]', 'meta[name="twitter:card"]', 'meta[name="twitter:title"]',
		'meta[name="twitter:description"]', 'meta[name="twitter:image"]'
	]) {
		await expect(page.locator(sel), sel).toHaveCount(1);
	}
	await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
	await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'id_ID');
	expect(await content(page, 'meta[property="og:url"]')).toBe(await page.locator('link[rel=canonical]').getAttribute('href'));
	await expect(page.locator('link[rel=alternate][type="application/rss+xml"]')).toHaveCount(1);
	await expect(page.locator('link[rel=alternate][type="application/rss+xml"]')).toHaveAttribute('href', new RegExp(`${ORIGIN.source}/artikel/rss\\.xml$`));
}

test.describe('[seo-metadata] Beranda', () => {
	test('metadata lengkap tanpa duplikasi, gambar bawaan 1200x630, dan JSON-LD TravelAgency + WebSite dalam satu blok', async ({ page }) => {
		await gotoReady(page, '/');
		await expectSingleTags(page);
		await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
		await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', new RegExp(`${ORIGIN.source}/$`));
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`${ORIGIN.source}/og-default\\.png$`));
		await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
		await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');

		const nodes = await graph(page);
		expect(typesExceptBusiness(nodes)).toEqual(['WebSite']);
		const agency = business(nodes);
		expect((agency.contactPoint as { telephone: string }).telephone).toBe(`+${WA_NUMBER}`);
		expect(node(nodes, 'WebSite')).toMatchObject({ inLanguage: 'id', name: 'Lembang Adventure', publisher: { '@id': agency['@id'] } });
		expect(String(agency['@id'])).toMatch(new RegExp(`^${ORIGIN.source}/#organization$`));
		expect(agency).toMatchObject({
			name: 'Lembang Adventure',
			alternateName: 'Lembang Adventure by Loox Travel',
			legalName: 'PT Loox Travel Luxury',
			geo: { '@type': 'GeoCoordinates', latitude: -6.810069, longitude: 107.6206394 },
			telephone: '+6282120209900',
			address: {
				'@type': 'PostalAddress',
				streetAddress: 'Jl. Laksana II No. 59, Jayagiri',
				addressLocality: 'Lembang',
				addressRegion: 'Jawa Barat',
				postalCode: '40391',
				addressCountry: 'ID'
			},
			areaServed: [{ '@type': 'City', name: 'Lembang' }, { '@type': 'City', name: 'Bandung' }]
		});
		expect(String(agency.url)).toMatch(new RegExp(`^${ORIGIN.source}/$`));
		expect(String(agency.hasMap)).toMatch(/^https:\/\/www\.google\.com\/maps\/place\//);
		expect(agency.sameAs).toEqual([agency.hasMap]);
		expect((agency.logo as { url: string }).url).toMatch(new RegExp(`^${ORIGIN.source}/apple-touch-icon\\.png$`));
		expect(agency).not.toHaveProperty('aggregateRating');
		expect(agency).not.toHaveProperty('review');
		expect(agency).not.toHaveProperty('openingHours');
		await expect(page.locator('footer')).toContainText('Jl. Laksana II No. 59, Jayagiri, Lembang, Kabupaten Bandung Barat, Jawa Barat 40391');
		await expect(page.locator('footer')).toContainText('WhatsApp +62 821-2020-9900');
	});

	test('/og-default.png berupa PNG 1200x630', async ({ request }) => {
		const res = await request.get('/og-default.png');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toContain('image/png');
		const png = await res.body();
		expect(png.subarray(1, 4).toString()).toBe('PNG');
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
	});
});

test.describe('[seo-metadata] Daftar dan halaman artikel', () => {
	test('/artikel: canonical, metadata lengkap, CollectionPage + BreadcrumbList dua butir', async ({ page }) => {
		await gotoReady(page, '/artikel');
		await expectSingleTags(page);
		await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', new RegExp(`${ORIGIN.source}/artikel$`));
		const nodes = await graph(page);
		expect(typesExceptBusiness(nodes)).toEqual(['CollectionPage', 'BreadcrumbList']);
		expect(business(nodes).name).toBe('Lembang Adventure');
		expect((node(nodes, 'BreadcrumbList').itemListElement as unknown[]).length).toBe(2);
	});

	test('artikel: og:type article, tanggal, gambar bawaan untuk sampul SVG, BlogPosting + BreadcrumbList tiga butir', async ({ page }) => {
		await gotoReady(page, ARTICLE);
		await expectSingleTags(page);
		await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
		await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute('content', '2026-09-15T00:00:00.000Z');
		await expect(page.locator('meta[property="article:modified_time"]')).toHaveCount(1);
		await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(`${ORIGIN.source}/og-default\\.png$`));
		await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /Sepakati 5 hal.* \| Lembang Adventure$/);

		const nodes = await graph(page);
		expect(typesExceptBusiness(nodes)).toEqual(['BlogPosting', 'BreadcrumbList']);
		const org = { '@id': business(nodes)['@id'] };
		expect(node(nodes, 'BlogPosting')).toMatchObject({
			author: org,
			publisher: org,
			headline: 'Mau gathering kantor? Sepakati 5 hal ini dulu.',
			datePublished: '2026-09-15T00:00:00.000Z',
			inLanguage: 'id'
		});
		const crumbs = node(nodes, 'BreadcrumbList').itemListElement as { position: number; name: string; item: string }[];
		expect(crumbs.map((c) => c.name)).toEqual(['Beranda', 'Artikel', 'Mau gathering kantor? Sepakati 5 hal ini dulu.']);
		expect(crumbs.map((c) => c.position)).toEqual([1, 2, 3]);
		expect(crumbs[2].item).toMatch(new RegExp(`${ORIGIN.source}${ARTICLE}$`));
	});
});

test.describe('[seo-metadata] Halaman paket', () => {
	test('Service merujuk bisnis lewat @id dan remah roti dua butir tanpa fragmen', async ({ page }) => {
		await gotoReady(page, '/paket/rafting');
		const nodes = await graph(page);
		expect(typesExceptBusiness(nodes)).toEqual(['Service', 'BreadcrumbList']);
		expect(node(nodes, 'Service').provider).toEqual({ '@id': business(nodes)['@id'] });
		const crumbs = node(nodes, 'BreadcrumbList').itemListElement as { item: string }[];
		expect(crumbs.map((c) => c.item.replace(ORIGIN, ''))).toEqual(['/', '/paket/rafting']);
	});
});

test.describe('[seo-metadata] Respons galat tidak diindeks', () => {
	test('404 publik membawa X-Robots-Tag noindex; halaman sukses tidak', async ({ request }) => {
		for (const url of ['/artikel/tidak-ada-sama-sekali', '/halaman-yang-tidak-ada']) {
			const res = await request.get(url);
			expect(res.status(), url).toBe(404);
			expect(res.headers()['x-robots-tag'], url).toBe('noindex');
		}
		for (const url of ['/', '/artikel', ARTICLE, '/sitemap.xml', '/artikel/rss.xml']) {
			const res = await request.get(url);
			expect(res.status(), url).toBe(200);
			expect(res.headers()['x-robots-tag'] ?? '', url).not.toContain('noindex');
		}
	});

	test('artikel draf (404) juga noindex', async ({ request }) => {
		const row = insertArticle(uniqueTitle('Tes Publik Noindex'));
		const res = await request.get(`/artikel/${row.slug}`);
		expect(res.status()).toBe(404);
		expect(res.headers()['x-robots-tag']).toBe('noindex');
	});
});

test.describe('[response-headers] Header keamanan dan cache CDN', () => {
	const SECURITY = {
		'x-content-type-options': 'nosniff',
		'referrer-policy': 'strict-origin-when-cross-origin',
		'permissions-policy': 'camera=(), microphone=(), geolocation=()'
	};

	test('halaman publik: header keamanan dan s-maxage=60', async ({ request }) => {
		for (const path of ['/', '/paket/offroad', '/artikel']) {
			const headers = (await request.get(path)).headers();
			expect(headers).toMatchObject({ ...SECURITY, 'x-frame-options': 'SAMEORIGIN' });
			expect(headers['cache-control']).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=60');
		}
	});

	test('admin tetap DENY dan no-store, tanpa s-maxage', async ({ request }) => {
		const headers = (await request.get('/admin/login')).headers();
		expect(headers).toMatchObject({ ...SECURITY, 'x-frame-options': 'DENY' });
		expect(headers['cache-control']).toBe('no-store');
	});

	test('404 publik membawa header keamanan tanpa s-maxage', async ({ request }) => {
		const res = await request.get('/paket/tidak-ada');
		expect(res.status()).toBe(404);
		expect(res.headers()).toMatchObject(SECURITY);
		expect(res.headers()['cache-control'] ?? '').not.toContain('s-maxage');
	});
});

test.describe('[sitemap-feeds] Sitemap', () => {
	test('memuat beranda, /artikel, dan artikel terbit dengan lastmod; tanpa draf dan admin', async ({ request }) => {
		const draft = insertArticle(uniqueTitle('Tes Publik Sitemap'));
		const res = await request.get('/sitemap.xml');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toBe('application/xml; charset=utf-8');
		expect(res.headers()['cache-control']).toBe('public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
		const xml = await res.text();
		expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
		const urls = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)].map((m) => ({ loc: m[1], lastmod: m[2] }));
		const locs = urls.map((u) => u.loc.replace(ORIGIN, ''));
		expect(locs.slice(0, 2)).toEqual(['/', '/artikel']);
		for (const slug of SEEDED) expect(locs).toContain(`/artikel/${slug}`);
		expect(locs).not.toContain(`/artikel/${draft.slug}`);
		expect(locs.some((l) => l.startsWith('/admin'))).toBe(false);
		// lastmod wajib untuk beranda, daftar artikel, artikel, dan paket; halaman statis tanpa tanggal boleh tanpa lastmod.
		const W3C = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
		for (const u of urls) {
			expect(u.loc).toMatch(ORIGIN);
			const path = u.loc.replace(ORIGIN, '');
			if (path === '/' || path === '/artikel' || /^\/(artikel|paket)\//.test(path)) expect(u.lastmod, u.loc).toMatch(W3C);
			else if (u.lastmod) expect(u.lastmod, u.loc).toMatch(W3C);
		}
	});
});

test.describe('[sitemap-feeds] Feed RSS', () => {
	test('RSS 2.0 dengan tiga artikel bawaan, terbaru dulu, header cache dan tipe konten benar', async ({ request }) => {
		const res = await request.get('/artikel/rss.xml');
		expect(res.status()).toBe(200);
		expect(res.headers()['content-type']).toBe('application/rss+xml; charset=utf-8');
		expect(res.headers()['cache-control']).toBe('public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
		const xml = await res.text();
		expect(xml).toContain('<rss version="2.0"');
		expect(xml).toContain('<language>id</language>');
		expect(xml).toMatch(/<atom:link href="http:\/\/127\.0\.0\.1:\d+\/artikel\/rss\.xml" rel="self" type="application\/rss\+xml"\/>/);
		const items = [...xml.matchAll(/<item>(.*?)<\/item>/g)].map((m) => m[1]);
		expect(items.length).toBeGreaterThanOrEqual(3);
		const order = SEEDED.map((slug) => xml.indexOf(`/artikel/${slug}</link>`));
		expect(order.every((i) => i > 0)).toBe(true);
		expect(order).toEqual([...order].sort((a, b) => a - b));
		const first = items.find((i) => i.includes(SEEDED[0]))!;
		expect(first).toContain('<title>Mau gathering kantor? Sepakati 5 hal ini dulu.</title>');
		expect(first).toContain(`<guid isPermaLink="true">`);
		expect(first).toContain('<pubDate>Tue, 15 Sep 2026 00:00:00 GMT</pubDate>');
		expect(first).toContain('<category>PERENCANAAN</category>');
		expect(first).toMatch(/<description>.+<\/description>/);
	});

	test('draf tidak ada di feed', async ({ request }) => {
		const row = insertArticle(uniqueTitle('Tes Publik Feed'));
		expect(await (await request.get('/artikel/rss.xml')).text()).not.toContain(row.slug);
	});
});
