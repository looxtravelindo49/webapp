import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
	it('dua blok dipisah baris kosong menjadi dua paragraf', () => {
		expect(renderMarkdown('Satu\n\nDua').match(/<p>/g)).toHaveLength(2);
	});

	it('heading level 1 dan 2 menjadi h2, level 3 ke atas h3, tanpa h1', () => {
		const html = renderMarkdown('# A\n\n## B\n\n### C\n\n#### D');
		expect(html).toContain('<h2>A</h2>');
		expect(html).toContain('<h2>B</h2>');
		expect(html).toContain('<h3>C</h3>');
		expect(html).toContain('<h3>D</h3>');
		expect(html).not.toContain('<h1');
	});

	it('mendukung daftar, kutipan, garis, tebal, dan miring', () => {
		const html = renderMarkdown('- a\n- b\n\n1. satu\n2. dua\n\n> kutip\n\n---\n\n**tebal** dan *miring*');
		expect(html).toContain('<ul>');
		expect(html).toContain('<ol>');
		expect(html).toContain('<blockquote>');
		expect(html).toContain('<hr>');
		expect(html).toContain('<strong>tebal</strong>');
		expect(html).toContain('<em>miring</em>');
	});

	it('HTML mentah di-escape', () => {
		const html = renderMarkdown('<script>alert(1)</script>');
		expect(html).not.toContain('<script');
		expect(html).toContain('&lt;script&gt;');
	});

	it('tidak ada elemen img atau atribut onerror dari HTML mentah', () => {
		const html = renderMarkdown('<img src=x onerror=alert(1)>');
		expect(html).not.toContain('<img');
		expect(html).not.toMatch(/<[^>]+onerror/);
	});

	it('gambar markdown tidak dirender sebagai img', () => {
		expect(renderMarkdown('![alt](https://example.com/a.png)')).not.toContain('<img');
	});

	it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html;base64,AAAA', 'vbscript:x', '//evil.com', 'file:///etc/passwd'])(
		'tautan berskema berbahaya %s tidak menjadi anchor',
		(url) => {
			const html = renderMarkdown(`[klik](${url})`);
			expect(html).not.toContain('<a');
			expect(html).not.toMatch(/href=/i);
		}
	);

	it('tautan eksternal membawa rel dan target', () => {
		const html = renderMarkdown('[Loox](https://example.com)');
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('rel="noopener noreferrer"');
		expect(html).toContain('target="_blank"');
	});

	it('tautan relatif, mailto, dan tel diizinkan tanpa target baru', () => {
		for (const url of ['/artikel', 'mailto:a@b.id', 'tel:+62812']) {
			const html = renderMarkdown(`[x](${url})`);
			expect(html).toContain(`href="${url}"`);
			expect(html).not.toContain('target=');
		}
	});

	it('kode dan tabel tidak dirender', () => {
		const html = renderMarkdown('`kode`\n\n```\nblok\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |');
		expect(html).not.toMatch(/<(code|pre|table)/);
	});

	it('kosong atau null menghasilkan string kosong', () => {
		expect(renderMarkdown('')).toBe('');
		expect(renderMarkdown(null)).toBe('');
	});
});
