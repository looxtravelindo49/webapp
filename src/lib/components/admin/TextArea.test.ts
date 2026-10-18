import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TextArea from './TextArea.svelte';
import Field from './Field.svelte';

const html = (props: Record<string, unknown>) => render(TextArea, { props: { label: 'Ringkasan', name: 'summary', ...props } }).body;

describe('TextArea (render server)', () => {
	it('nilai awal menjadi isi elemen (bukan atribut value) dan di-escape', () => {
		const body = html({ value: 'baris 1\nbaris <b>2</b> & "kutip"' });
		expect(body).toMatch(/<textarea[^>]*>baris 1\nbaris &lt;b>2&lt;\/b> &amp; "kutip"<\/textarea>/);
		expect(body).not.toMatch(/<textarea[^>]*\svalue=/);
		expect(body).not.toContain('<b>2</b>');
	});

	it('kosong: elemen kosong tanpa atribut value', () => {
		const body = html({});
		expect(body).toMatch(/<textarea[^>]*><\/textarea>/);
		expect(body).not.toMatch(/\svalue=/);
	});

	it('label terhubung, rows, maxlength, dan required diteruskan', () => {
		const body = html({ rows: 6, maxlength: 300, required: true });
		const id = body.match(/<textarea[^>]*\sid="([^"]+)"/)![1];
		expect(body).toContain(`for="${id}"`);
		expect(body).toContain('rows="6"');
		expect(body).toContain('maxlength="300"');
		expect(body).toMatch(/<textarea[^>]*required/);
	});

	it('kesalahan: role=alert terhubung lewat aria-describedby dan aria-invalid', () => {
		const body = html({ error: 'Ringkasan wajib diisi.', hint: 'Petunjuk' });
		const ids = body.match(/aria-describedby="([^"]+)"/)![1].split(' ');
		expect(ids).toHaveLength(2);
		for (const i of ids) expect(body).toContain(`id="${i}"`);
		expect(body).toMatch(/role="alert"[^>]*>Ringkasan wajib diisi\./);
		expect(body).toContain('aria-invalid="true"');
	});

	it('tanpa kesalahan: tidak ada role=alert', () => {
		expect(html({})).not.toContain('role="alert"');
	});
});

describe('Field: inputmode dan placeholder', () => {
	const field = (props: Record<string, unknown>) => render(Field, { props: { label: 'Harga', name: 'price', ...props } }).body;
	it('meneruskan inputmode dan placeholder', () => {
		const body = field({ inputmode: 'numeric', placeholder: 'mis. 250000' });
		expect(body).toContain('inputmode="numeric"');
		expect(body).toContain('placeholder="mis. 250000"');
	});
	it('tanpa keduanya tidak menambah atribut', () => {
		const body = field({});
		expect(body).not.toContain('inputmode');
		expect(body).not.toContain('placeholder');
	});
});
