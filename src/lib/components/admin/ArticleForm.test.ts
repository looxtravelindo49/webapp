import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ArticleForm from './ArticleForm.svelte';
import { emptyRaw } from '#lib/article-form.js';

const html = (props: Record<string, unknown> = {}) =>
	render(ArticleForm, { props: { values: emptyRaw(), submitLabel: 'Simpan', ...props } as never }).body;

describe('ArticleForm: pemilih Unsplash', () => {
	it('tanpa kunci: tombol Unsplash dan isian tersembunyi tidak ada; unggahan tetap ada', () => {
		const body = html({ unsplashEnabled: false });
		expect(body).not.toContain('Cari di Unsplash');
		expect(body).not.toContain('name="unsplash_id"');
		expect(body).toContain('name="photo"');
	});
	it('dengan kunci: tombol Unsplash, isian tersembunyi kosong, dan unggahan tersedia', () => {
		const body = html({ unsplashEnabled: true });
		expect(body).toContain('Cari di Unsplash');
		expect(body).toMatch(/<input type="hidden" name="unsplash_id" value=""/);
		expect(body).toContain('name="photo"');
		expect(body).toContain('membutuhkan JavaScript');
	});
	it('sampul Unsplash tersimpan: pratinjau berukuran dari images.unsplash.com dan kredit tampil', () => {
		const body = html({
			cover: 'https://images.unsplash.com/photo-1?ixid=ID1', credit: { name: 'Ana', url: 'https://unsplash.com/@ana' }
		});
		expect(body).toMatch(/src="https:\/\/images\.unsplash\.com\/photo-1\?[^"]*w=160/);
		expect(body).toContain('Foto Unsplash oleh Ana.');
	});
	it('sampul dari host lain tidak dipakai', () => {
		const body = html({ cover: 'https://evil.com/a.jpg' });
		expect(body).toContain('src="/media/forest.svg"');
		expect(body).not.toContain('evil.com');
	});
});
