import { describe, expect, it } from 'vitest';
import { emptyRaw, LIMITS, parseArticleForm, rawFromArticle, readUnsplashId, UNSPLASH_INVALID_MESSAGE } from './article-form';

const form = (fields: Record<string, string>) => ({ get: (k: string) => fields[k] ?? null });
const valid = { title: ' Tips Gathering ', category: ' PERENCANAAN ', excerpt: ' Ringkas ', body: ' Isi artikel ' };

describe('parseArticleForm', () => {
	it('memangkas masukan dan menerima isian valid', () => {
		const r = parseArticleForm(form(valid));
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.values).toEqual({
				title: 'Tips Gathering', category: 'PERENCANAAN', excerpt: 'Ringkas', body: 'Isi artikel',
				cover_alt: null, published: false, featured: false
			});
		}
	});

	it('judul, kategori, dan ringkasan wajib', () => {
		const r = parseArticleForm(form({ title: '  ', category: '', excerpt: '\n', body: '' }));
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.errors.title).toBe('Judul wajib diisi.');
			expect(r.errors.category).toBe('Kategori wajib diisi.');
			expect(r.errors.excerpt).toBe('Ringkasan wajib diisi.');
		}
	});

	it('menolak teks melebihi batas dengan pesan yang menyebut batasnya', () => {
		const r = parseArticleForm(
			form({ ...valid, title: 'a'.repeat(LIMITS.title + 1), category: 'a'.repeat(41), excerpt: 'a'.repeat(301), body: 'a'.repeat(20_001), cover_alt: 'a'.repeat(201) })
		);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.errors.title).toContain('120');
			expect(r.errors.category).toContain('40');
			expect(r.errors.excerpt).toContain('300');
			expect(r.errors.body).toContain('karakter');
			expect(r.errors.cover_alt).toContain('200');
		}
	});

	it('batas tepat diterima', () => {
		const r = parseArticleForm(form({ ...valid, excerpt: 'a'.repeat(300), title: 'a'.repeat(120) }));
		expect(r.ok).toBe(true);
	});

	it('draf boleh berisi kosong, terbit tidak', () => {
		expect(parseArticleForm(form({ ...valid, body: '' })).ok).toBe(true);
		const r = parseArticleForm(form({ ...valid, body: '  ', published: '1' }));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.body).toBe('Isi artikel wajib diisi sebelum diterbitkan.');
	});

	it('kotak centang terbit dan populer', () => {
		const r = parseArticleForm(form({ ...valid, published: '1', featured: '1' }));
		expect(r.ok && r.values.published && r.values.featured).toBe(true);
	});

	it('mempertahankan isian mentah saat gagal', () => {
		const r = parseArticleForm(form({ ...valid, title: '', body: 'baris 1\r\nbaris 2' }));
		expect(r.ok).toBe(false);
		expect(r.raw.category).toBe(' PERENCANAAN ');
		expect(r.raw.body).toBe('baris 1\nbaris 2');
	});
});

describe('rawFromArticle / emptyRaw', () => {
	it('memetakan artikel tersimpan ke isian form', () => {
		expect(
			rawFromArticle({ title: 'T', category: 'C', excerpt: 'E', body: 'B', cover_alt: null, published: 1, featured: 0 })
		).toEqual({ title: 'T', category: 'C', excerpt: 'E', body: 'B', cover_alt: '', published: true, featured: false });
		expect(emptyRaw().published).toBe(false);
	});
});

describe('readUnsplashId', () => {
	it('kosong atau tidak ada → none', () => {
		expect(readUnsplashId(form({}))).toEqual({ kind: 'none' });
		expect(readUnsplashId(form({ unsplash_id: '   ' }))).toEqual({ kind: 'none' });
	});
	it('id sah (dipangkas) diterima', () => {
		expect(readUnsplashId(form({ unsplash_id: ' abc_123-XY ' }))).toEqual({ kind: 'id', id: 'abc_123-XY' });
	});
	it.each(['abc', 'a'.repeat(41), 'abc/../x', 'abc 123', 'abc?x=1', '<script>', 'https://unsplash.com/photos/abc123'])('%j → galat', (v) => {
		expect(readUnsplashId(form({ unsplash_id: v }))).toEqual({ kind: 'error', message: UNSPLASH_INVALID_MESSAGE });
	});
});
