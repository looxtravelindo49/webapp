import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Field from './Field.svelte';

const html = (props: Record<string, unknown>) =>
	render(Field, { props: { label: 'Login', name: 'login', ...props } }).body;

describe('Field (render server)', () => {
	it('tanpa atribut value saat kosong (hidrasi tidak boleh menimpa isian yang sudah diketik)', () => {
		expect(html({})).not.toMatch(/\svalue=/);
		expect(html({ value: '' })).not.toMatch(/\svalue=/);
	});

	it('memasang value bila ada isinya', () => {
		expect(html({ value: 'budi' })).toMatch(/value="budi"/);
	});

	it('tidak pernah mengembalikan nilai ke input password', () => {
		const body = html({ type: 'password', name: 'password', value: 'rahasia-banget' });
		expect(body).not.toContain('rahasia-banget');
		expect(body).toContain('type="password"');
	});

	it('menautkan label ke input dan pesan kesalahan lewat aria-describedby (role=alert)', () => {
		const body = html({ error: 'Login sudah dipakai.', hint: 'Petunjuk' });
		const id = body.match(/<input[^>]*\sid="([^"]+)"/)![1];
		expect(body).toContain(`for="${id}"`);
		const describedBy = body.match(/aria-describedby="([^"]+)"/)![1].split(' ');
		expect(describedBy).toHaveLength(2);
		for (const d of describedBy) expect(body).toContain(`id="${d}"`);
		expect(body).toMatch(/role="alert"[^>]*>Login sudah dipakai\./);
		expect(body).toContain('aria-invalid="true"');
	});

	it('tanpa kesalahan: tidak ada role=alert dan tidak ada aria-invalid', () => {
		const body = html({});
		expect(body).not.toContain('role="alert"');
		expect(body).not.toContain('aria-invalid');
	});
});
