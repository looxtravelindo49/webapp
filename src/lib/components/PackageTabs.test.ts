import { describe, expect, it } from 'vitest';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import PackageTabs from './PackageTabs.svelte';
import type { Package } from '#lib/types.js';

const pkg = (slug: string, title: string, extra: Partial<Package> = {}): Package => ({
	id: 1,
	slug,
	title,
	summary: `ringkasan ${title}`,
	body: 'isi',
	includes: 'satu\ndua\ntiga',
	notes: '',
	image: '/media/forest.svg',
	image_alt: null,
	duration: null,
	price_per_person: null,
	min_pax: 1,
	published: 1,
	sort_order: 1,
	...extra
});

describe('PackageTabs (render server)', () => {
	it('merender semua panel di HTML awal dengan hanya tab pertama terpilih', () => {
		const { body } = render(PackageTabs, {
			props: { packages: [pkg('a', 'Alfa'), pkg('b', 'Beta')] }
		});
		expect(body).toContain('ringkasan Alfa');
		expect(body).toContain('ringkasan Beta');
		expect(body.match(/aria-selected="true"/g)).toHaveLength(1);
		expect(body.match(/role="tabpanel"/g)).toHaveLength(2);
	});

	it('menampilkan harga, "/ orang", dan minimal peserta', () => {
		const { body } = render(PackageTabs, {
			props: {
				packages: [pkg('a', 'Alfa', { price_per_person: 250000, min_pax: 10 }), pkg('b', 'Beta')]
			}
		});
		expect(body).toContain('Rp 250.000');
		expect(body).toContain('/ orang');
		expect(body).toContain('Minimal 10 peserta');
		expect(body).toContain('Harga menyusul');
	});

	it('menampilkan 3 butir fasilitas', () => {
		const { body } = render(PackageTabs, { props: { packages: [pkg('a', 'Alfa')] } });
		expect(body.match(/<li class="flex gap-2.5"/g)).toHaveLength(3);
	});

	it('men-escape HTML pada data', () => {
		const { body } = render(PackageTabs, {
			props: { packages: [pkg('a', 'Alfa', { summary: '<script>alert(1)</script>' })] }
		});
		expect(body).not.toContain('<script>alert(1)');
		expect(body).toContain('&lt;script');
	});

	it('tanpa paket: pesan kosong dan tanpa tablist', () => {
		const { body } = render(PackageTabs, { props: { packages: [] } });
		expect(body).toContain('Paket sedang disiapkan');
		expect(body).not.toContain('role="tablist"');
	});

	it('merender slot aksi per paket', () => {
		const action = createRawSnippet<[Package]>((p) => ({
			render: () => `<button class="aksi">Tambah ${p().title}</button>`
		}));
		const { body } = render(PackageTabs, {
			props: { packages: [pkg('a', 'Alfa'), pkg('b', 'Beta')], action }
		});
		expect(body).toContain('Tambah Alfa');
		expect(body).toContain('Tambah Beta');
	});
});
