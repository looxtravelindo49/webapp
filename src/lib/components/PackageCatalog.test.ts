import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PackageCatalog from './PackageCatalog.svelte';
import type { Package } from '#lib/types.js';

const pkg = (slug: string, title: string, extra: Partial<Package> = {}): Package => ({
	id: 1,
	slug,
	title,
	summary: '',
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
	it('menampilkan tiga kartu dan menyembunyikan sisanya di dalam details', () => {
		const body = html([
			pkg('offroad', 'Offroad Land Rover', { duration: '2-3 Jam', price_per_person: 249000, min_pax: 7 }),
			pkg('team-building', 'Team Building', { min_pax: 20 }),
			pkg('rafting', 'Rafting', { price_per_person: 125000, min_pax: 5 }),
			pkg('paintball', 'Paintball', { duration: '   ', min_pax: 10 })
		]);
		expect(body).toContain('Katalog paket');
		expect(body).toContain('>Offroad Land Rover<');
		expect(body).toContain('by Loox Travel');
		expect(body).toContain('>Lembang<');
		expect(body).toContain('>Bandung<');
		expect(body).toContain('>Jawa Barat<');
		expect(body).toContain('2-3 Jam');
		expect(body).toContain('Rp249rb/orang');
		expect(body).toContain('Min. 7 orang');
		expect(body).toContain('href="/paket/offroad"');
		expect(body).toContain('Add Offroad');
		expect(body).toContain('Add Team Building');
		const details = body.match(/<details[\s\S]*<\/details>/)?.[0] ?? '';
		expect(details).toContain('Lihat semua paket');
		expect(details).toContain('Add Paintball');
		expect(details).not.toContain('Add Offroad');
		expect(body.indexOf('Add Paintball')).toBeGreaterThan(body.indexOf('Lihat semua paket'));
	});

	it('tanpa sisa tidak menampilkan tombol lihat semua', () => {
		const body = html([pkg('offroad', 'Offroad', { duration: '' })]);
		expect(body).not.toContain('Lihat semua paket');
		expect(body).not.toContain('2-3 Jam');
	});
});
