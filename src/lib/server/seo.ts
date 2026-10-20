import { site } from '#lib/content/site.js';
import { siteUrl } from './site';

export function robotsTxt(base: string = siteUrl()): string {
	return `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${base}/sitemap.xml\n`;
}

export const escapeXml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

/** Cache untuk sitemap dan feed: CDN menyimpan sejam, lalu menyajikan basi sambil memperbarui. */
export const FEED_CACHE_CONTROL = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export type SitemapEntry = { path: string; lastmod?: string | null };

/** `2026-09-15T00:00:00.000Z` → W3C datetime; nilai kosong atau tidak valid → null. */
function w3cDate(value: string | null | undefined): string | null {
	const d = value ? new Date(value) : null;
	return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

export function sitemapXml(base: string = siteUrl(), entries: SitemapEntry[] = [{ path: '/' }]): string {
	const urls = entries
		.map((e) => {
			const lastmod = w3cDate(e.lastmod);
			return `<url><loc>${escapeXml(base + e.path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
		})
		.join('');
	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

/** Tanggal terbaru dari beberapa nilai (ISO); null bila tidak ada yang valid. */
export function latestDate(...values: (string | null | undefined)[]): string | null {
	const valid = values.map(w3cDate).filter((v): v is string => v !== null);
	return valid.length ? valid.sort().at(-1)! : null;
}

/**
 * Entri sitemap: beranda, daftar artikel, dan tiap artikel terbit. `lastmod` beranda = yang terbaru dari paket
 * terbit dan artikel terbit; `lastmod` daftar = artikel terbit terbaru.
 */
export function sitemapEntries(articles: { slug: string; updated_at: string }[], packagesUpdatedAt: string | null): SitemapEntry[] {
	const articlesLatest = latestDate(...articles.map((a) => a.updated_at));
	return [
		{ path: '/', lastmod: latestDate(packagesUpdatedAt, articlesLatest) },
		{ path: '/artikel', lastmod: articlesLatest },
		{ path: '/kebijakan-pembayaran', lastmod: null },
		...articles.map((a) => ({ path: `/artikel/${a.slug}`, lastmod: a.updated_at }))
	];
}

export const RSS_LIMIT = 20;

export type FeedArticle = {
	slug: string;
	title: string;
	category: string;
	excerpt: string;
	published_at: string | null;
};

/** RSS 2.0 untuk artikel terbit; `articles` sudah diurutkan terbaru dulu. */
export function rssXml(base: string = siteUrl(), articles: FeedArticle[], now: Date = new Date()): string {
	const items = articles
		.slice(0, RSS_LIMIT)
		.map((a) => {
			const link = escapeXml(`${base}/artikel/${a.slug}`);
			const date = a.published_at ? new Date(a.published_at) : null;
			return (
				`<item><title>${escapeXml(a.title)}</title><link>${link}</link>` +
				`<guid isPermaLink="true">${link}</guid>` +
				(date && !Number.isNaN(date.getTime()) ? `<pubDate>${date.toUTCString()}</pubDate>` : '') +
				`<description>${escapeXml(a.excerpt)}</description><category>${escapeXml(a.category)}</category></item>`
			);
		})
		.join('');
	return (
		`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>` +
		`<title>${escapeXml(`Artikel ${site.name}`)}</title><link>${escapeXml(`${base}/artikel`)}</link>` +
		`<description>${escapeXml(site.description)}</description><language>id</language>` +
		`<lastBuildDate>${now.toUTCString()}</lastBuildDate>` +
		`<atom:link href="${escapeXml(`${base}/artikel/rss.xml`)}" rel="self" type="application/rss+xml"/>` +
		`${items}</channel></rss>`
	);
}
