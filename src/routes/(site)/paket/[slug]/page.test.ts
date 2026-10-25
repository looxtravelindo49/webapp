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

const html = (over: Partial<typeof pkg> = {}, gallery?: { src: string; alt: string | null }[]) =>
	render(Page, {
		props: { data: { pkg: { ...pkg, ...over }, siteUrl: 'https://contoh.id', waNumber: null, gallery }, form: null, params: { slug: 'offroad' } } as never
	}).body;

describe('halaman detail paket', () => {
	it('menampilkan data paket dan tautan ke kalkulator', () => {
		const body = html();
		expect(body).toContain('Offroad Land Rover');
		expect(body).toContain('Durasi 1–3 jam');
		expect(body).toContain('Titik kumpul Cikole, bisa juga start dari hotel area Lembang');
		expect(body).toContain('Transport');
		expect(body).toContain('Makan');
		expect(body).toContain('Dokumentasi');
		expect(body).not.toContain('2-3 Jam');
		expect(body).toContain('Rp 249.000');
		expect(body).toContain('Min. 7 orang');
		expect(body).toContain('Offroad di Cikole, Lembang, Bandung');
		expect(body).toContain('Rp 249.000 per mobil');
		expect(body).toContain('>Include<');
		expect(body).not.toContain('Pilihan yang dapat dibahas');
		expect(body).toContain('href="/?paket=offroad#konsultasi"');
		expect(body).toContain('Tambah ke Trip');
		expect(body).toContain('Jeep di hutan pinus');
	});

	it('galeri: satu foto besar dan tiga thumbnail, tanpa foto tunggal terpisah', () => {
		const body = html({}, [
			{ src: '/media/camp.svg', alt: 'Satu' },
			{ src: '/media/river.svg', alt: 'Dua' },
			{ src: '/media/paintball.svg', alt: 'Tiga' },
			{ src: '/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c.jpg', alt: null }
		]);
		expect(body).toContain('alt="Satu"');
		expect(body).toContain('loading="eager"');
		expect(body.match(/loading="lazy"/g)).toHaveLength(3);
		expect(body).toContain('data-autoplay-ms="4000"');
		expect(body).toContain('aria-label="Tampilkan Jeep di hutan pinus"');
		expect(body).toContain('alt="Dua"');
		expect(body).toContain('alt="Tiga"');
		expect(body).toContain('alt="Jeep di hutan pinus"');
		expect(body).not.toContain('alt=""');
		expect(body).not.toContain('src="/media/forest.svg"');
	});

	it('menampilkan fasilitas kustom sebagai Include, dan menyembunyikan daftar bila kosong', () => {
		const withBullets = html({ slug: 'flying-fox', includes: 'Perlengkapan\nIsi 40 peluru per orang' });
		expect(withBullets).toContain('>Include<');
		expect(withBullets).toContain('Isi 40 peluru per orang');
		expect(withBullets).not.toContain('Pilihan yang dapat dibahas');
		expect(withBullets).not.toContain('100 peluru');
		expect(html({ slug: 'flying-fox', includes: '' })).not.toContain('>Include<');
	});

	it('rafting memakai lokasi Ciater dan tidak menampilkan teks perahu atau briefing', () => {
		const body = html({
			slug: 'rafting',
			title: 'Rafting',
			summary: 'Susuri arus sungai bersama tim dengan perahu karet dan arahan pemandu.',
			includes: 'Briefing sebelum mulai'
		});
		expect(body).toContain('Rafting di Ciater, Lembang, Bandung');
		expect(body).toContain('Lokasi Ciater');
		expect(body).toContain('Peralatan rafting');
		expect(body).not.toContain('perahu');
		expect(body).not.toContain('Briefing');
	});

	it('menyembunyikan durasi yang kosong pada paket tanpa cerita', () => {
		expect(html({ slug: 'flying-fox', duration: '  ' })).not.toContain('>Durasi<');
		expect(html({ slug: 'flying-fox', duration: null })).not.toContain('2-3 Jam');
	});
});
