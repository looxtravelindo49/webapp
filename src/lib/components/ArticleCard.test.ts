import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ArticleCard from './ArticleCard.svelte';

const RAW = 'https://images.unsplash.com/photo-9?ixlib=rb-4.1.0&ixid=IDX';
const card = (cover_image: string | null, cover = true) =>
	render(ArticleCard, {
		props: { article: { slug: 'tips', title: 'Tips', category: 'TIPS', excerpt: 'Ringkas.', cover_image, cover_alt: 'alt', published_at: '2026-09-15T00:00:00.000Z' }, cover }
	}).body;

describe('ArticleCard', () => {
	it('sampul Unsplash: gambar 600 px dari images.unsplash.com dengan ixid', () => {
		const body = card(RAW);
		expect(body).toMatch(/src="https:\/\/images\.unsplash\.com\/photo-9\?[^"]*w=600[^"]*"/);
		expect(body).toContain('ixid=IDX');
		expect(body).toContain('href="/artikel/tips"');
	});
	it('URL dari host lain atau kosong → gambar bawaan', () => {
		for (const bad of ['https://evil.com/a.jpg', null]) expect(card(bad)).toContain('src="/media/forest.svg"');
	});
	it('unggahan lokal dipakai apa adanya', () => {
		expect(card('/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c.png')).toContain('src="/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c.png"');
	});
	it('tanpa mode sampul tidak merender gambar', () => {
		expect(card(RAW, false)).not.toContain('<img');
	});
});
