import { siteUrl } from './site';

export function robotsTxt(base: string = siteUrl()): string {
	return `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${base}/sitemap.xml\n`;
}

const escapeXml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

export function sitemapXml(base: string = siteUrl(), paths: string[] = ['/']): string {
	const urls = paths.map((p) => `<url><loc>${escapeXml(base + p)}</loc></url>`).join('');
	return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}
