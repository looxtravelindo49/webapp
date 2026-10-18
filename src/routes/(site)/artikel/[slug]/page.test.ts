import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const RAW = 'https://images.unsplash.com/photo-9?ixlib=rb-4.1.0&ixid=IDX';
const article = (over: Record<string, unknown> = {}) => ({
	id: 1, slug: 'tips', title: 'Tips', category: 'TIPS', excerpt: 'Ringkas.', cover_image: RAW, cover_alt: null,
	cover_credit_name: 'Ana Budi', cover_credit_url: 'https://unsplash.com/@anabudi', cover_unsplash_id: 'abc123',
	published: 1, featured: 0, published_at: '2026-09-15T00:00:00.000Z', created_at: '2026-09-15T00:00:00.000Z', updated_at: '2026-09-15T00:00:00.000Z', ...over
});
const out = (a: Record<string, unknown>, utmSource = 'lembang_adventures') =>
	render(Page, { props: { data: { article: a, html: '<p>Isi</p>', siteUrl: 'https://contoh.id', waNumber: null, utmSource } as never, params: { slug: 'tips' } } as never });
const html = (a: Record<string, unknown>, utmSource?: string) => out(a, utmSource).body;
const figure = (body: string) => body.match(/<figure[\s\S]*?<\/figure>/)?.[0] ?? '';

describe('halaman artikel dengan sampul Unsplash', () => {
	it('memuat gambar dari images.unsplash.com ber-ukuran dengan ixid, dan atribusi ber-UTM', () => {
		const f = figure(html(article()));
		expect(f).toMatch(/src="https:\/\/images\.unsplash\.com\/photo-9\?[^"]*w=1200[^"]*"/);
		expect(f).toContain('ixid=IDX');
		expect(f).toContain('<figcaption');
		expect(f).toContain('Foto oleh');
		expect(f).toContain('href="https://unsplash.com/@anabudi?utm_source=lembang_adventures&amp;utm_medium=referral"');
		expect(f).toContain('href="https://unsplash.com/?utm_source=lembang_adventures&amp;utm_medium=referral"');
		expect(f.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
		expect(f).toContain('Ana Budi');
	});

	it('memakai nama aplikasi dari konfigurasi untuk utm_source', () => {
		expect(figure(html(article(), 'app_lain'))).toContain('utm_source=app_lain');
	});

	it('profil tidak valid → nama tanpa tautan, tetap ada tautan Unsplash', () => {
		const f = figure(html(article({ cover_credit_url: 'https://evil.com/@ana' })));
		expect(f).not.toContain('evil.com');
		expect(f).toContain('Ana Budi');
		expect(f).toContain('href="https://unsplash.com/?utm_source=');
	});

	it('URL gambar dari host lain → gambar bawaan dan tanpa atribusi', () => {
		const f = figure(html(article({ cover_image: 'https://evil.com/a.jpg' })));
		expect(f).toContain('src="/media/forest.svg"');
		expect(f).not.toContain('figcaption');
		expect(f).not.toContain('evil.com');
	});

	it('sampul unggahan atau tanpa sampul → tanpa atribusi Unsplash', () => {
		for (const over of [
			{ cover_image: '/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c.jpg', cover_credit_name: null, cover_credit_url: null, cover_unsplash_id: null },
			{ cover_image: null, cover_credit_name: null, cover_credit_url: null, cover_unsplash_id: null }
		]) {
			const body = html(article(over));
			expect(figure(body)).not.toContain('figcaption');
			expect(body).not.toContain('Unsplash');
		}
	});

	it('og:image memakai URL Unsplash 1200x630', () => {
		const og = out(article()).head.match(/<meta property="og:image" content="([^"]+)"/)?.[1] ?? '';
		expect(og).toContain('https://images.unsplash.com/photo-9');
		expect(og).toContain('w=1200');
		expect(og).toContain('h=630');
	});
});
