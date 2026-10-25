import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PackageCatalog from './PackageCatalog.svelte';
import type { Package } from '#lib/types.js';

const pkg = (slug: string, title: string, extra: Partial<Package> = {}): Package => ({
	id: 1,
	slug,
	title,
	summary: `Ringkasan ${title} untuk tim.`,
	body: '',
	includes: '',
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

const html = (packages: Package[]) => render(PackageCatalog, { props: { packages } }).body;

describe('PackageCatalog', () => {
	it('menampilkan kartu sesuai mockup: badge, harga, filter, dan tautan detail', () => {
		const body = html([
			pkg('offroad', 'Offroad Cikole', {
				duration: '2-3 Jam',
				price_per_person: 249000,
				min_pax: 7,
				pricing_mode: 'per_unit',
				kapasitas_per_unit: 7,
				nama_unit: 'mobil'
			}),
			pkg('team-building', 'Team Building', { price_per_person: 125000, min_pax: 20 }),
			pkg('fun-games', 'Fun Games', { min_pax: 20 }),
			pkg('paintball', 'Paintball', { price_per_person: 125000, min_pax: 10 }),
			pkg('rafting', 'Rafting', { price_per_person: 125000, min_pax: 5, image: '/media/river.svg' })
		]);
		expect(body).toContain('HANDPICKED EXPERIENCES');
		expect(body).toContain('Aktivitas Pilihan di Lembang');
		expect(body).toContain('Reset filter');
		expect(body).toContain('>Semua<');
		expect(body).toContain('>Adventure<');
		expect(body).toContain('>Untuk Grup<');
		expect(body).toContain('>Corporate<');
		expect(body).toContain('Paling Dicari');
		expect(body).toContain('Cikole, Lembang · Setengah hari');
		expect(body).toContain('Cikole, Lembang · Termasuk 40 peluru');
		expect(body).toContain('Lokasi sungai sesuai konsultasi');
		expect(body).toContain('>Offroad Cikole<');
		expect(body).toContain('Rp249.000');
		expect(body).toContain('/pax*');
		expect(body).toContain('Min. 7 peserta');
		expect(body).toContain('Rp125.000');
		expect(body).toContain('/orang');
		expect(body).toContain('Minta penawaran');
		expect(body).toContain('href="/paket/offroad"');
		expect(body).toContain('Lihat Detail');
		expect(body).toContain('grid-cols-2');
		expect(body).toContain('md:grid-cols-3');
		expect(body).toContain('lg:grid-cols-4');
		expect(body).toContain('line-clamp-2');
		expect(body).toContain('*Offroad dihitung per mobil (maks. 7 orang/mobil). Harga final dikonfirmasi via WhatsApp.');
		expect(body).toContain('src="/media/rafting.webp"');
		expect(body).toContain('alt="Peserta rafting memakai rompi pelampung di tepi sungai"');
		expect(body).not.toContain('src="/media/river.svg"');
		expect(body).not.toContain('Lihat semua paket');
		expect(body).not.toContain('by Loox Travel');
		expect(body).not.toContain('Add Offroad');
	});

	it('kartu memakai foto galeri pertama bila ada', () => {
		const body = html([
			pkg('offroad', 'Offroad', { image: '/media/forest.svg', image_alt: 'Utama', cover_image: '/media/camp.svg', cover_alt: 'Galeri' })
		]);
		expect(body).toContain('src="/media/camp.svg"');
		expect(body).toContain('alt="Galeri"');
		expect(body).not.toContain('src="/media/forest.svg"');
	});

	it('alt galeri kosong memakai nama paket, bukan alt foto utama', () => {
		const body = html([
			pkg('offroad', 'Offroad', { image: '/media/forest.svg', image_alt: 'Utama', cover_image: '/media/camp.svg', cover_alt: '  ' })
		]);
		expect(body).toContain('src="/media/camp.svg"');
		expect(body).toContain('alt="Offroad"');
		expect(body).not.toContain('alt="Utama"');
	});

	it('tanpa galeri tetap memakai foto paket', () => {
		const body = html([pkg('offroad', 'Offroad', { image: '/media/forest.svg', image_alt: 'Utama' })]);
		expect(body).toContain('src="/media/forest.svg"');
		expect(body).toContain('alt="Utama"');
	});

	it('paket tanpa ringkasan tidak memaksa deskripsi', () => {
		const body = html([pkg('lain', 'Lain', { summary: '   ', duration: '2 jam' })]);
		expect(body).toContain('Lembang · 2 jam');
		expect(body).not.toContain('line-clamp-2');
		expect(body).not.toContain('Lihat semua paket');
	});
});
