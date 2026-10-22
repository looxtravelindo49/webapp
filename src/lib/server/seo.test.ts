import { describe, expect, it } from 'vitest';
import { openDatabase } from './db';
import { health } from './health';
import { escapeXml, FEED_CACHE_CONTROL, latestDate, robotsTxt, rssXml, RSS_LIMIT, sitemapEntries, sitemapXml, type FeedArticle } from './seo';

/** Tidak ada `&` mentah (selain entitas XML): pemeriksaan ringan tanpa pengurai XML. */
const noRawAmpersand = (xml: string) => !/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml);

describe('robots.txt dan sitemap', () => {
	it('melarang /admin/ dan menunjuk sitemap absolut', async () => {
		const txt = robotsTxt('https://contoh.id');
		expect(txt).toContain('Disallow: /admin/');
		expect(txt).toContain('Sitemap: https://contoh.id/sitemap.xml');
	});
	it('sitemap bawaan memuat halaman beranda', async () => {
		expect(sitemapXml('https://contoh.id')).toContain('<loc>https://contoh.id/</loc>');
	});
	it('entri memuat loc absolut dan lastmod W3C; tanpa lastmod bila kosong atau tidak valid', () => {
		const xml = sitemapXml('https://contoh.id', [
			{ path: '/', lastmod: '2026-09-15T00:00:00.000Z' },
			{ path: '/artikel' },
			{ path: '/artikel/x', lastmod: 'bukan tanggal' }
		]);
		expect(xml).toContain('<url><loc>https://contoh.id/</loc><lastmod>2026-09-15T00:00:00.000Z</lastmod></url>');
		expect(xml).toContain('<url><loc>https://contoh.id/artikel</loc></url>');
		expect(xml).toContain('<url><loc>https://contoh.id/artikel/x</loc></url>');
		expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
	});
	it('meng-escape & dalam URL', () => {
		const xml = sitemapXml('https://contoh.id', [{ path: '/a?x=1&y=2' }]);
		expect(xml).toContain('/a?x=1&amp;y=2');
		expect(noRawAmpersand(xml)).toBe(true);
	});
	it('latestDate mengambil yang terbaru dan mengabaikan nilai tidak valid', () => {
		expect(latestDate('2026-01-01T00:00:00.000Z', null, 'x', '2026-03-01T00:00:00.000Z')).toBe('2026-03-01T00:00:00.000Z');
		expect(latestDate(null, undefined)).toBeNull();
	});
});

describe('sitemapEntries', () => {
	const articles = [
		{ slug: 'baru', updated_at: '2026-10-01T00:00:00.000Z' },
		{ slug: 'lama', updated_at: '2026-09-01T00:00:00.000Z' }
	];
	it('beranda, daftar, dan tiap artikel dengan lastmod', () => {
		expect(sitemapEntries(articles, '2026-08-01T00:00:00.000Z', [], '2026-07-30T00:00:00.000Z')).toEqual([
			{ path: '/', lastmod: '2026-10-01T00:00:00.000Z' },
			{ path: '/artikel', lastmod: '2026-10-01T00:00:00.000Z' },
			{ path: '/portfolio', lastmod: '2026-07-30T00:00:00.000Z' },
			{ path: '/kebijakan-pembayaran', lastmod: null },
			{ path: '/artikel/baru', lastmod: '2026-10-01T00:00:00.000Z' },
			{ path: '/artikel/lama', lastmod: '2026-09-01T00:00:00.000Z' }
		]);
	});
	it('lastmod beranda mengikuti paket bila lebih baru dari artikel', () => {
		expect(sitemapEntries(articles, '2027-01-01T00:00:00.000Z')[0].lastmod).toBe('2027-01-01T00:00:00.000Z');
	});
	it('tanpa artikel: hanya beranda dan daftar; tanpa data → tanpa lastmod', () => {
		expect(sitemapEntries([], null)).toEqual([
			{ path: '/', lastmod: null },
			{ path: '/artikel', lastmod: null },
			{ path: '/portfolio', lastmod: null },
			{ path: '/kebijakan-pembayaran', lastmod: null }
		]);
		const xml = sitemapXml('https://contoh.id', sitemapEntries([], null));
		expect(xml).toContain('<loc>https://contoh.id/artikel</loc>');
		expect(xml).not.toContain('<lastmod>');
	});
	it('menambahkan halaman detail paket terbit', () => {
		expect(sitemapEntries([], null, [{ slug: 'offroad', updated_at: '2026-10-02T00:00:00.000Z' }])).toEqual([
			{ path: '/', lastmod: null },
			{ path: '/artikel', lastmod: null },
			{ path: '/portfolio', lastmod: null },
			{ path: '/kebijakan-pembayaran', lastmod: null },
			{ path: '/paket/offroad', lastmod: '2026-10-02T00:00:00.000Z' }
		]);
	});
});

const art = (i: number, over: Partial<FeedArticle> = {}): FeedArticle => ({
	slug: `artikel-${i}`, title: `Judul ${i}`, category: 'TIPS', excerpt: `Ringkasan ${i}.`, published_at: `2026-09-${String(i).padStart(2, '0')}T00:00:00.000Z`, ...over
});

describe('rssXml', () => {
	const now = new Date('2026-10-18T10:00:00.000Z');
	it('channel memuat title, link, description, language, lastBuildDate, dan atom:link self', () => {
		const xml = rssXml('https://contoh.id', [], now);
		expect(xml).toContain('<rss version="2.0"');
		expect(xml).toContain('<link>https://contoh.id/artikel</link>');
		expect(xml).toContain('<language>id</language>');
		expect(xml).toContain('<lastBuildDate>Sun, 18 Oct 2026 10:00:00 GMT</lastBuildDate>');
		expect(xml).toContain('<atom:link href="https://contoh.id/artikel/rss.xml" rel="self" type="application/rss+xml"/>');
		expect(xml).not.toContain('<item>');
	});
	it('item memuat title, link, guid permalink, pubDate RFC 822, description, dan category', () => {
		const xml = rssXml('https://contoh.id', [art(15)], now);
		expect(xml).toContain('<title>Judul 15</title>');
		expect(xml).toContain('<link>https://contoh.id/artikel/artikel-15</link>');
		expect(xml).toContain('<guid isPermaLink="true">https://contoh.id/artikel/artikel-15</guid>');
		expect(xml).toContain('<pubDate>Tue, 15 Sep 2026 00:00:00 GMT</pubDate>');
		expect(xml).toContain('<description>Ringkasan 15.</description>');
		expect(xml).toContain('<category>TIPS</category>');
	});
	it('mempertahankan urutan masukan dan membatasi 20 item', () => {
		const list = Array.from({ length: 25 }, (_, i) => art(i + 1));
		const xml = rssXml('https://contoh.id', list, now);
		expect((xml.match(/<item>/g) ?? []).length).toBe(RSS_LIMIT);
		expect(xml.indexOf('artikel-1<')).toBeLessThan(xml.indexOf('artikel-2<'));
		expect(xml).not.toContain('artikel-21<');
	});
	it('meng-escape karakter khusus pada judul, ringkasan, dan kategori', () => {
		const xml = rssXml('https://contoh.id', [art(1, { title: 'Tips & Trik <Seru>', excerpt: '"kutip" & \'apos\'', category: 'A&B' })], now);
		expect(xml).toContain('<title>Tips &amp; Trik &lt;Seru&gt;</title>');
		expect(xml).toContain('<category>A&amp;B</category>');
		expect(noRawAmpersand(xml)).toBe(true);
		expect(xml).not.toContain('<Seru>');
	});
	it('artikel tanpa published_at tidak memiliki pubDate', () => {
		expect(rssXml('https://contoh.id', [art(1, { published_at: null })], now)).not.toContain('<pubDate>');
	});
});

describe('escapeXml dan konstanta', () => {
	it('meng-escape lima karakter', () => expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;'));
	it('header cache feed', () => expect(FEED_CACHE_CONTROL).toBe('public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'));
});

describe('health', () => {
	it('200 bila database terbaca', async () => {
		const db = await openDatabase(':memory:');
		const res = await health(async () => db);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
	it('503 bila database gagal dibuka atau ditutup', async () => {
		expect((await health(async () => { throw new Error('x'); })).status).toBe(503);
		const db = await openDatabase(':memory:');
		db.close();
		expect((await health(async () => db)).status).toBe(503);
	});
});
