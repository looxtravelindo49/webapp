import { describe, expect, it } from 'vitest';
import {
	absoluteUrl, articleNodes, breadcrumbNode, businessNode, collectionNodes, jsonLdGraph, packageNodes, serializeJsonLd, shareImage, websiteNode
} from './seo';

const BASE = 'https://contoh.id';
const site = { name: 'Lembang Adventure', description: 'Deskripsi situs.' };
const UUID = '0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c';

describe('absoluteUrl', () => {
	it('menggabungkan origin dan path dengan satu garis miring', () => {
		expect(absoluteUrl(BASE, '/artikel')).toBe('https://contoh.id/artikel');
		expect(absoluteUrl(BASE, 'artikel')).toBe('https://contoh.id/artikel');
		expect(absoluteUrl(BASE, '/')).toBe('https://contoh.id/');
	});
});

describe('shareImage', () => {
	it.each(['jpg', 'png', 'webp'])('sampul unggahan .%s dipakai (absolut)', (ext) => {
		expect(shareImage(BASE, `/uploads/${UUID}.${ext}`)).toEqual({ url: `${BASE}/uploads/${UUID}.${ext}`, isDefault: false });
	});
	it.each([null, undefined, '', '/media/forest.svg', `/uploads/${UUID}.avif`, '/uploads/../etc.png', `/uploads/${UUID}.png?x=1`, 'https://evil.example/a.png'])(
		'%j memakai gambar bawaan',
		(cover) => {
			expect(shareImage(BASE, cover)).toEqual({ url: `${BASE}/og-default.png`, isDefault: true });
		}
	);
});

describe('shareImage dengan foto Unsplash', () => {
	const RAW = 'https://images.unsplash.com/photo-1?ixlib=rb-4.1.0&ixid=ABC';
	it('memakai URL Unsplash 1200x630 dengan ixid terjaga dan bukan gambar bawaan', () => {
		const img = shareImage(BASE, RAW);
		expect(img.isDefault).toBe(false);
		const u = new URL(img.url);
		expect(u.origin).toBe('https://images.unsplash.com');
		expect(u.searchParams.get('w')).toBe('1200');
		expect(u.searchParams.get('h')).toBe('630');
		expect(u.searchParams.get('ixid')).toBe('ABC');
	});
	it('URL dari host lain tidak dipakai', () => {
		expect(shareImage(BASE, 'https://evil.com/a.jpg')).toEqual({ url: `${BASE}/og-default.png`, isDefault: true });
	});
	it('JSON-LD artikel memakai URL Unsplash yang sama', () => {
		const [post] = articleNodes(BASE, { slug: 't', title: 'T', excerpt: 'e', published_at: null, updated_at: '2026-01-01T00:00:00.000Z', cover_image: RAW }) as [{ image: string[] }];
		expect(post.image[0]).toBe(shareImage(BASE, RAW).url);
	});
});

describe('serializeJsonLd', () => {
	it('meng-escape < > & sehingga tidak dapat menutup script, dan tetap dapat diurai', () => {
		const title = '</script><script>alert(1)</script> & <b>';
		const out = serializeJsonLd({ headline: title });
		expect(out).not.toMatch(/[<>&]/);
		expect(JSON.parse(out).headline).toBe(title);
	});
});

describe('node JSON-LD', () => {
	const ORG = { '@id': `${BASE}/#organization` };
	const MAPS = /^https:\/\/www\.google\.com\/maps\/place\/Loox\+Travel/;

	it('node bisnis memuat contactPoint hanya bila nomor WhatsApp ada', () => {
		const withWa = businessNode(BASE, '6282120209900') as { contactPoint?: { telephone: string } };
		expect(withWa.contactPoint?.telephone).toBe('+6282120209900');
		expect('contactPoint' in businessNode(BASE, null)).toBe(false);
		expect('contactPoint' in businessNode(BASE)).toBe(false);
	});

	it('node bisnis tunggal: TravelAgency ber-@id #organization dengan NAP, badan hukum, lokasi, dan logo', () => {
		const node = businessNode(BASE) as Record<string, unknown> & { hasMap: string; sameAs: string[] };
		expect(node).toMatchObject({
			'@type': 'TravelAgency',
			'@id': `${BASE}/#organization`,
			name: 'Lembang Adventure',
			alternateName: 'Lembang Adventure by Loox Travel',
			legalName: 'PT Loox Travel Luxury',
			url: `${BASE}/`,
			logo: { '@type': 'ImageObject', url: `${BASE}/apple-touch-icon.png`, width: 180, height: 180 },
			image: `${BASE}/og-default.png`,
			telephone: '+6282120209900',
			address: {
				'@type': 'PostalAddress',
				streetAddress: 'Jl. Laksana II No. 59, Jayagiri',
				addressLocality: 'Lembang',
				addressRegion: 'Jawa Barat',
				postalCode: '40391',
				addressCountry: 'ID'
			},
			geo: { '@type': 'GeoCoordinates', latitude: -6.810069, longitude: 107.6206394 },
			areaServed: [{ '@type': 'City', name: 'Lembang' }, { '@type': 'City', name: 'Bandung' }]
		});
		expect(node.hasMap).toMatch(MAPS);
		expect(node.sameAs).toEqual([node.hasMap]);
		for (const key of ['aggregateRating', 'review', 'openingHours', 'openingHoursSpecification']) {
			expect(node).not.toHaveProperty(key);
		}
	});

	it('WebSite menunjuk publisher bisnis lewat @id yang sama', () => {
		const web = websiteNode(BASE, site) as { publisher: { '@id': string }; inLanguage: string };
		expect(web.publisher).toEqual(ORG);
		expect((businessNode(BASE) as { '@id': string })['@id']).toBe(ORG['@id']);
		expect(web.inLanguage).toBe('id');
	});

	const pkg = { slug: 'offroad', title: 'Offroad', summary: 'Ringkas.', image: null, price_per_person: 249000, updated_at: '2026-10-01T00:00:00.000Z' };

	it('Service paket merujuk bisnis lewat @id, dan remah roti dua butir tanpa fragmen', () => {
		const [service, crumbs] = packageNodes(BASE, pkg) as [Record<string, unknown>, { itemListElement: { item: string }[] }];
		expect(service).toMatchObject({ '@type': 'Service', provider: ORG, offers: { '@type': 'Offer', priceCurrency: 'IDR', price: 249000 } });
		expect(crumbs.itemListElement.map((i) => i.item)).toEqual([`${BASE}/`, `${BASE}/paket/offroad`]);
		expect(crumbs.itemListElement.every((i) => !i.item.includes('#'))).toBe(true);
	});

	it('paket tanpa harga tidak memuat offers', () => {
		const [service] = packageNodes(BASE, { ...pkg, price_per_person: null }) as [Record<string, unknown>];
		expect('offers' in service).toBe(false);
	});

	it('BreadcrumbList berposisi 1..n dengan URL absolut', () => {
		const b = breadcrumbNode(BASE, [{ name: 'A', path: '/' }, { name: 'B', path: '/artikel' }]) as { itemListElement: { position: number; item: string }[] };
		expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
		expect(b.itemListElement.map((i) => i.item)).toEqual(['https://contoh.id/', 'https://contoh.id/artikel']);
	});

	const article = { slug: 'tips', title: 'Tips Gathering', excerpt: 'Ringkas.', published_at: '2026-09-15T00:00:00.000Z', updated_at: '2026-09-20T00:00:00.000Z', cover_image: `/uploads/${UUID}.jpg` };

	it('BlogPosting + BreadcrumbList tiga butir untuk artikel', () => {
		const [post, crumbs] = articleNodes(BASE, article) as [Record<string, unknown>, { itemListElement: { name: string }[] }];
		expect(post).toMatchObject({
			'@type': 'BlogPosting',
			headline: 'Tips Gathering',
			datePublished: '2026-09-15T00:00:00.000Z',
			dateModified: '2026-09-20T00:00:00.000Z',
			image: [`${BASE}/uploads/${UUID}.jpg`],
			mainEntityOfPage: { '@id': `${BASE}/artikel/tips` },
			author: ORG,
			publisher: ORG,
			inLanguage: 'id'
		});
		expect(crumbs.itemListElement.map((i) => i.name)).toEqual(['Beranda', 'Artikel', 'Tips Gathering']);
	});

	it('artikel tanpa sampul unggahan memakai gambar bawaan; tanpa published_at tidak ada datePublished', () => {
		const [post] = articleNodes(BASE, { ...article, cover_image: '/media/forest.svg', published_at: null }) as [Record<string, unknown>];
		expect(post.image).toEqual([`${BASE}/og-default.png`]);
		expect('datePublished' in post).toBe(false);
	});

	it('CollectionPage + BreadcrumbList dua butir untuk daftar', () => {
		const [page, crumbs] = collectionNodes(BASE, 'Artikel', 'Desk') as [Record<string, unknown>, { itemListElement: unknown[] }];
		expect(page).toMatchObject({ '@type': 'CollectionPage', url: `${BASE}/artikel` });
		expect(crumbs.itemListElement).toHaveLength(2);
	});

	it('jsonLdGraph membungkus node dengan @context dan @graph', () => {
		expect(jsonLdGraph([{ '@type': 'X' }])).toEqual({ '@context': 'https://schema.org', '@graph': [{ '@type': 'X' }] });
	});
});
