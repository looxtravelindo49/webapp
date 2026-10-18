/** Pembangun metadata dan JSON-LD (murni, aman dipakai di server maupun klien). */
import { unsplashSized } from './images';

export const OG_DEFAULT_PATH = '/og-default.png';
export const OG_DEFAULT_SIZE = { width: 1200, height: 630 } as const;

/** URL absolut dari origin situs dan path (`/artikel`, `artikel`). */
export function absoluteUrl(base: string, path: string): string {
	return base + (path.startsWith('/') ? path : `/${path}`);
}

/** Hanya unggahan raster yang dikenali pratinjau sosial; SVG bawaan dan AVIF memakai gambar bawaan. */
const SHAREABLE_COVER = /^\/uploads\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export type ShareImage = { url: string; isDefault: boolean };

/**
 * Gambar untuk `og:image`: foto Unsplash (hotlink, 1200×630) atau sampul unggahan (JPEG/PNG/WebP) bila ada,
 * selain itu gambar bawaan.
 */
export function shareImage(base: string, cover?: string | null): ShareImage {
	const unsplash = unsplashSized(cover, { w: OG_DEFAULT_SIZE.width, h: OG_DEFAULT_SIZE.height });
	if (unsplash) return { url: unsplash, isDefault: false };
	if (cover && SHAREABLE_COVER.test(cover)) return { url: absoluteUrl(base, cover), isDefault: false };
	return { url: absoluteUrl(base, OG_DEFAULT_PATH), isDefault: true };
}

type Node = Record<string, unknown>;

/** Serialisasi JSON-LD yang aman ditaruh di dalam `<script>`: `<`, `>`, `&` di-escape. */
export function serializeJsonLd(data: unknown): string {
	return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** Bungkus beberapa node menjadi satu dokumen `@graph`. */
export function jsonLdGraph(nodes: Node[]): Node {
	return { '@context': 'https://schema.org', '@graph': nodes };
}

export type Site = { name: string; description: string };

export function organizationNode(base: string, site: Site, waNumber?: string | null): Node {
	return {
		'@type': 'Organization',
		'@id': `${base}/#organization`,
		name: site.name,
		url: `${base}/`,
		description: site.description,
		...(waNumber
			? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: `+${waNumber}`, availableLanguage: 'id' } }
			: {})
	};
}

export function websiteNode(base: string, site: Site): Node {
	return {
		'@type': 'WebSite',
		'@id': `${base}/#website`,
		name: site.name,
		url: `${base}/`,
		inLanguage: 'id',
		publisher: { '@id': `${base}/#organization` }
	};
}

export type Crumb = { name: string; path: string };

export function breadcrumbNode(base: string, items: Crumb[]): Node {
	return {
		'@type': 'BreadcrumbList',
		itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absoluteUrl(base, c.path) }))
	};
}

export type ArticleMeta = {
	slug: string;
	title: string;
	excerpt: string;
	published_at: string | null;
	updated_at: string;
	cover_image: string | null;
};

/** `BlogPosting` + `BreadcrumbList` untuk halaman artikel. */
export function articleNodes(base: string, site: Site, a: ArticleMeta): Node[] {
	const url = absoluteUrl(base, `/artikel/${a.slug}`);
	const organization = { '@type': 'Organization', name: site.name, url: `${base}/` };
	return [
		{
			'@type': 'BlogPosting',
			headline: a.title,
			description: a.excerpt,
			...(a.published_at ? { datePublished: a.published_at } : {}),
			dateModified: a.updated_at,
			image: [shareImage(base, a.cover_image).url],
			author: organization,
			publisher: organization,
			mainEntityOfPage: { '@type': 'WebPage', '@id': url },
			url,
			inLanguage: 'id'
		},
		breadcrumbNode(base, [
			{ name: 'Beranda', path: '/' },
			{ name: 'Artikel', path: '/artikel' },
			{ name: a.title, path: `/artikel/${a.slug}` }
		])
	];
}

/** `CollectionPage` + `BreadcrumbList` untuk daftar artikel. */
export function collectionNodes(base: string, name: string, description: string): Node[] {
	return [
		{ '@type': 'CollectionPage', name, description, url: absoluteUrl(base, '/artikel'), inLanguage: 'id' },
		breadcrumbNode(base, [
			{ name: 'Beranda', path: '/' },
			{ name: 'Artikel', path: '/artikel' }
		])
	];
}
