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
	it('merender semua slide di HTML awal, slide pertama aktif', () => {
		const { body } = render(PackageTabs, {
			props: { packages: [pkg('a', 'Alfa'), pkg('b', 'Beta')] }
		});
		expect(body).toContain('ringkasan Alfa');
		expect(body).toContain('ringkasan Beta');
		expect(body).toContain('id="kegiatan-a"');
		expect(body).toContain('id="kegiatan-b"');
		expect(body).toContain('aria-roledescription="carousel"');
		expect(body).toContain('role="tablist"');
		expect(body.match(/role="tab"/g)).toHaveLength(2);
		expect(body.match(/aria-selected="true"/g)).toHaveLength(1);
		expect(body.match(/aria-roledescription="slide"/g)).toHaveLength(2);
		expect(body).toContain('aria-label="Paket sebelumnya"');
		expect(body).toContain('aria-label="Paket berikutnya"');
		expect(body).not.toContain('Geser ke');
		expect(body.match(/\sinert(?:=|>|\s)/g)).toHaveLength(1);
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

	it('galeri paket terpilih; paket tanpa galeri tetap satu foto', () => {
		const { body } = render(PackageTabs, {
			props: {
				packages: [
					pkg('offroad', 'Offroad', {
						image: '/media/forest.svg',
						image_alt: 'Utama',
						gallery: [
							{ src: '/media/camp.svg', alt: 'Satu' },
							{ src: '/media/river.svg', alt: 'Dua' },
							{ src: '/media/paintball.svg', alt: 'Tiga' },
							{ src: '/media/forest.svg', alt: null }
						]
					}),
					pkg('rafting', 'Rafting', { image: '/media/river.svg', image_alt: 'Sungai' })
				]
			}
		});
		expect(body).toContain('alt="Satu"');
		expect(body).toContain('alt="Dua"');
		expect(body).toContain('alt="Tiga"');
		expect(body).toContain('alt="Utama"');
		expect(body).toContain('data-autoplay-ms="4000"');
		expect(body).toContain('src="/media/river.svg"');
		expect(body).toContain('alt="Sungai"');
		expect(body).not.toContain('alt=""');
		expect(body).not.toContain('touch-pan-y');
		expect(body.match(/data-autoplay-ms="4000"/g)).toHaveLength(1);
	});

	it('menampilkan 3 butir fasilitas sebagai Include', () => {
		const { body } = render(PackageTabs, { props: { packages: [pkg('a', 'Alfa')] } });
		expect(body).toContain('>Include<');
		expect(body).not.toContain('Pilihan yang dapat dibahas');
		expect(body.match(/<li class="flex gap-2.5"/g)).toHaveLength(3);
	});

	it('satu paket: satu pil, tanpa panah', () => {
		const { body } = render(PackageTabs, { props: { packages: [pkg('a', 'Alfa')] } });
		expect(body.match(/role="tab"/g)).toHaveLength(1);
		expect(body).toContain('>Alfa</button>');
		expect(body).not.toContain('Paket sebelumnya');
	});

	it('men-escape HTML pada data', () => {
		const { body } = render(PackageTabs, {
			props: { packages: [pkg('a', 'Alfa', { summary: '<script>alert(1)</script>' })] }
		});
		expect(body).not.toContain('<script>alert(1)');
		expect(body).toContain('&lt;script');
	});

	it('tanpa paket: pesan kosong dan tanpa carousel', () => {
		const { body } = render(PackageTabs, { props: { packages: [] } });
		expect(body).toContain('Paket sedang disiapkan');
		expect(body).not.toContain('aria-roledescription="carousel"');
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
