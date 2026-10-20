import { describe, expect, it } from 'vitest';
import {
	absoluteUrl, articleNodes, breadcrumbNode, collectionNodes, jsonLdGraph, organizationNode, serializeJsonLd, shareImage, websiteNode
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
		const [post] = articleNodes(BASE, site, { slug: 't', title: 'T', excerpt: 'e', published_at: null, updated_at: '2026-01-01T00:00:00.000Z', cover_image: RAW }) as [{ image: string[] }];
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
	it('Organization memuat contactPoint hanya bila nomor WhatsApp ada', () => {
		const withWa = organizationNode(BASE, site, '6282120209900') as { contactPoint?: { telephone: string } };
		expect(withWa.contactPoint?.telephone).toBe('+6282120209900');
		expect('contactPoint' in organizationNode(BASE, site, null)).toBe(false);
		expect('contactPoint' in organizationNode(BASE, site)).toBe(false);
	});

	it('WebSite menunjuk publisher Organization lewat @id yang sama', () => {
		const org = organizationNode(BASE, site) as { '@id': string };
		const web = websiteNode(BASE, site) as { publisher: { '@id': string }; inLanguage: string };
		expect(web.publisher['@id']).toBe(org['@id']);
		expect(web.inLanguage).toBe('id');
	});

	it('BreadcrumbList berposisi 1..n dengan URL absolut', () => {
		const b = breadcrumbNode(BASE, [{ name: 'A', path: '/' }, { name: 'B', path: '/artikel' }]) as { itemListElement: { position: number; item: string }[] };
		expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
		expect(b.itemListElement.map((i) => i.item)).toEqual(['https://contoh.id/', 'https://contoh.id/artikel']);
	});

	const article = { slug: 'tips', title: 'Tips Gathering', excerpt: 'Ringkas.', published_at: '2026-09-15T00:00:00.000Z', updated_at: '2026-09-20T00:00:00.000Z', cover_image: `/uploads/${UUID}.jpg` };

	it('BlogPosting + BreadcrumbList tiga butir untuk artikel', () => {
		const [post, crumbs] = articleNodes(BASE, site, article) as [Record<string, unknown>, { itemListElement: { name: string }[] }];
		expect(post).toMatchObject({
			'@type': 'BlogPosting',
			headline: 'Tips Gathering',
			datePublished: '2026-09-15T00:00:00.000Z',
			dateModified: '2026-09-20T00:00:00.000Z',
			image: [`${BASE}/uploads/${UUID}.jpg`],
			mainEntityOfPage: { '@id': `${BASE}/artikel/tips` },
			inLanguage: 'id'
		});
		expect(crumbs.itemListElement.map((i) => i.name)).toEqual(['Beranda', 'Artikel', 'Tips Gathering']);
	});

	it('artikel tanpa sampul unggahan memakai gambar bawaan; tanpa published_at tidak ada datePublished', () => {
		const [post] = articleNodes(BASE, site, { ...article, cover_image: '/media/forest.svg', published_at: null }) as [Record<string, unknown>];
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
