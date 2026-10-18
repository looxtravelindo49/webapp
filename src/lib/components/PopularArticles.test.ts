import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PopularArticles from './PopularArticles.svelte';

const RAW = 'https://images.unsplash.com/photo-9?ixlib=rb-4.1.0&ixid=IDX';
const article = (i: number, cover_image: string | null) => ({
	id: i, slug: `artikel-${i}`, title: `Judul ${i}`, category: 'TIPS', excerpt: `Ringkasan ${i}.`, cover_image, cover_alt: i === 1 ? 'alt satu' : null,
	published_at: '2026-09-15T00:00:00.000Z'
});
const html = (articles: ReturnType<typeof article>[]) => render(PopularArticles, { props: { articles: articles as never } }).body;
const cards = (body: string) => body.match(/<a href="\/artikel\/[^"]+"[\s\S]*?<\/a>/g) ?? [];

describe('PopularArticles', () => {
	it('setiap kartu memuat tepat satu gambar sampul di atas kategori dan judul', () => {
		const list = cards(html([article(1, '/media/camp.svg'), article(2, RAW), article(3, null)]));
		expect(list).toHaveLength(3);
		for (const card of list) {
			expect(card.match(/<img /g)).toHaveLength(1);
			expect(card.indexOf('<img ')).toBeLessThan(card.indexOf('TIPS'));
			expect(card).toContain('loading="lazy"');
			expect(card).toContain('width="600"');
			expect(card).toContain('height="338"');
		}
	});

	it('sumber gambar: unggahan/bawaan apa adanya, Unsplash berukuran 600 dengan ixid, kosong → gambar bawaan', () => {
		const [local, unsplash, none] = cards(html([article(1, '/media/camp.svg'), article(2, RAW), article(3, null)]));
		expect(local).toContain('src="/media/camp.svg"');
		expect(unsplash).toMatch(/src="https:\/\/images\.unsplash\.com\/photo-9\?[^"]*w=600[^"]*"/);
		expect(unsplash).toContain('ixid=IDX');
		expect(none).toContain('src="/media/forest.svg"');
	});

	it('sampul dari host asing atau path tidak aman → gambar bawaan', () => {
		for (const bad of ['https://evil.com/a.jpg', '/etc/passwd', 'javascript:alert(1)']) {
			const [card] = cards(html([article(1, bad)]));
			expect(card).toContain('src="/media/forest.svg"');
			expect(card).not.toContain('evil.com');
		}
	});

	it('teks alternatif dari sampul; kosong bila tidak ada', () => {
		const [first, second] = cards(html([article(1, '/media/camp.svg'), article(2, '/media/forest.svg')]));
		expect(first).toContain('alt="alt satu"');
		expect(second).toContain('alt=""');
	});

	it('tanpa artikel, section tidak dirender', () => {
		expect(html([])).not.toContain('artikel-populer');
	});
});
