import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Page from './+page.svelte';

const pkg = {
	id: 1,
	slug: 'offroad',
	title: 'Offroad Land Rover',
	summary: 'Keluar dari rutinitas.',
	body: 'Nikmati kegiatan offroad.\n\nRute disesuaikan.',
	includes: '',
	notes: '',
	image: '/media/forest.svg',
	image_alt: 'Jeep di hutan pinus',
	duration: '2-3 Jam' as string | null,
	price_per_person: 249000,
	min_pax: 7,
	published: 1,
	sort_order: 1,
	updated_at: '2026-10-02T00:00:00.000Z'
};

const html = (over: Partial<typeof pkg> = {}) =>
	render(Page, {
		props: { data: { pkg: { ...pkg, ...over }, siteUrl: 'https://contoh.id', waNumber: null }, form: null, params: { slug: 'offroad' } } as never
	}).body;

describe('halaman detail paket', () => {
	it('menampilkan data paket dan tautan ke kalkulator', () => {
		const body = html();
		expect(body).toContain('Offroad Land Rover');
		expect(body).toContain('2-3 Jam');
		expect(body).toContain('Rp 249.000');
		expect(body).toContain('Min. 7 orang');
		expect(body).toContain('Nikmati kegiatan offroad.');
		expect(body).toContain('Rute disesuaikan.');
		expect(body).toContain('href="/?paket=offroad#konsultasi"');
		expect(body).toContain('Tambah ke Trip');
		expect(body).toContain('Jeep di hutan pinus');
	});

	it('menyembunyikan durasi yang kosong', () => {
		expect(html({ duration: '  ' })).not.toContain('Durasi');
		expect(html({ duration: null })).not.toContain('2-3 Jam');
	});
});
