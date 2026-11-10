/** Pembangun metadata dan JSON-LD (murni, aman dipakai di server maupun klien). */
import { businessAddress, businessProfile, site as brand } from './content/site';
import { unsplashSized } from './images';
import { FLOAT_WA_NUMBER } from './whatsapp';

export const OG_DEFAULT_PATH = '/og-default.png';
export const OG_DEFAULT_SIZE = { width: 1200, height: 630 } as const;

/** Logo bisnis untuk JSON-LD: raster persegi ≥112 px (syarat logo Google). */
const LOGO_PATH = '/apple-touch-icon.png';
const LOGO_SIZE = 180;

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

/** `@id` satu-satunya entitas bisnis; semua node lain merujuk bisnis lewat id ini. */
export function businessId(base: string): string {
	return `${base}/#organization`;
}

const businessRef = (base: string) => ({ '@id': businessId(base) });

/**
 * Satu node bisnis untuk seluruh situs: `TravelAgency` (turunan `LocalBusiness` → `Organization`).
 * `contactPoint` hanya bila nomor WhatsApp pengaturan diisi. Tanpa rating, ulasan, atau jam buka:
 * rating Google tidak boleh ditandai sendiri, dan jam buka belum tersedia.
 */
export function businessNode(base: string, waNumber?: string | null): Node {
	return {
		'@type': 'TravelAgency',
		'@id': businessId(base),
		name: brand.name,
		alternateName: businessProfile.alternateName,
		legalName: businessProfile.legalName,
		description: brand.description,
		url: `${base}/`,
		logo: { '@type': 'ImageObject', url: absoluteUrl(base, LOGO_PATH), width: LOGO_SIZE, height: LOGO_SIZE },
		image: absoluteUrl(base, OG_DEFAULT_PATH),
		telephone: `+${FLOAT_WA_NUMBER}`,
		address: {
			'@type': 'PostalAddress',
			streetAddress: businessAddress.streetAddress,
			addressLocality: businessAddress.addressLocality,
			addressRegion: businessAddress.addressRegion,
			postalCode: businessAddress.postalCode,
			addressCountry: businessAddress.addressCountry
		},
		geo: { '@type': 'GeoCoordinates', latitude: businessProfile.geo.latitude, longitude: businessProfile.geo.longitude },
		hasMap: businessProfile.mapsUrl,
		sameAs: [businessProfile.mapsUrl],
		areaServed: businessProfile.areaServed.map((name) => ({ '@type': 'City', name })),
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
		publisher: businessRef(base)
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
export function articleNodes(base: string, a: ArticleMeta): Node[] {
	const url = absoluteUrl(base, `/artikel/${a.slug}`);
	return [
		{
			'@type': 'BlogPosting',
			headline: a.title,
			description: a.excerpt,
			...(a.published_at ? { datePublished: a.published_at } : {}),
			dateModified: a.updated_at,
			image: [shareImage(base, a.cover_image).url],
			author: businessRef(base),
			publisher: businessRef(base),
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

export type PackageMeta = {
	slug: string;
	title: string;
	summary: string;
	image: string | null;
	price_per_person: number | null;
	updated_at: string;
};

/** `Service` + remah roti dua butir (Beranda › paket) untuk halaman detail paket. */
export function packageNodes(base: string, p: PackageMeta): Node[] {
	const url = absoluteUrl(base, `/paket/${p.slug}`);
	const service: Node = {
		'@type': 'Service',
		name: p.title,
		description: p.summary,
		serviceType: 'Paket aktivitas',
		url,
		image: [shareImage(base, p.image).url],
		provider: businessRef(base),
		areaServed: 'Lembang, Bandung, Jawa Barat',
		dateModified: p.updated_at
	};
	if (p.price_per_person !== null) {
		service.offers = { '@type': 'Offer', priceCurrency: 'IDR', price: p.price_per_person, url };
	}
	return [
		service,
		breadcrumbNode(base, [
			{ name: 'Beranda', path: '/' },
			{ name: p.title, path: `/paket/${p.slug}` }
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
