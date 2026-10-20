import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import TripHarness from './testing/TripHarness.svelte';
import type { Package } from '#lib/types.js';

const pkg = (slug: string, title: string, price: number | null, min_pax = 1): Package => ({
	id: 1, slug, title, summary: `ringkasan ${title}`, body: '', includes: '', notes: '', image: '/media/forest.svg',
	image_alt: null, duration: null, price_per_person: price, min_pax, published: 1, sort_order: 1
});
const packages = [
	pkg('offroad', 'Offroad', 250000),
	pkg('rafting', 'Rafting', 200000, 10),
	pkg('paintball', 'Paintball', 150000),
	pkg('fun-games', 'Fun Games', null)
];

const html = (props: Record<string, unknown> = {}) =>
	render(TripHarness, { props: { packages, ...props } }).body;
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('section Konsultasikan Tripmu (render server)', () => {
	it('ada di HTML awal dengan judul dan keadaan kosong', () => {
		const body = html();
		expect(body).toContain('id="konsultasi"');
		expect(body).toContain('Konsultasikan');
		expect(body).toContain('Tripmu.');
		expect(body).toContain('Pilih minimal satu paket');
		expect(body).not.toContain('Total estimasi</div>');
	});

	it('muncul setelah #paket dan memuat satu checkbox per paket terbit', () => {
		const body = html();
		expect(body.indexOf('id="paket"')).toBeGreaterThan(-1);
		expect(body.indexOf('id="konsultasi"')).toBeGreaterThan(body.indexOf('id="paket"'));
		expect(count(body, /type="checkbox"/g)).toBe(4);
	});

	it('menampilkan harga per orang, "Harga menyusul", dan minimal peserta', () => {
		const body = html();
		expect(body).toContain('Rp 250.000 / orang');
		expect(body).toContain('Harga menyusul');
		expect(body).toContain('Minimal 10 peserta');
	});

	it('tidak memiliki isian Tujuan atau Anggaran', () => {
		const body = html();
		expect(body).not.toMatch(/>\s*Tujuan\s*</);
		expect(body).not.toMatch(/Anggaran/);
		expect(body).toContain('Nama tim / perusahaan');
		expect(body).toContain('Jumlah peserta');
		expect(body).toContain('Nomor WhatsApp');
		expect(body).toContain('Tanggal rencana (opsional)');
		expect(body).toContain('Catatan (opsional)');
	});

	it('tidak memuat tautan wa.me di HTML awal', () => {
		expect(html({ waNumber: '6282120209900' })).not.toContain('wa.me');
	});

	it('tombol "Kirim ke WhatsApp" hanya ada bila nomor tujuan valid; tidak ada Simpan PDF', () => {
		const tanpa = html({ waNumber: null });
		expect(tanpa).not.toContain('Kirim ke WhatsApp');
		expect(tanpa).toContain('Pengiriman lewat WhatsApp sedang tidak aktif.');
		expect(tanpa).not.toContain('Simpan PDF');
		expect(html({ waNumber: '6282120209900' })).toContain('Kirim ke WhatsApp');
		expect(html({ waNumber: '6282120209900' })).not.toContain('Simpan PDF');
		expect(html({ waNumber: '6282120209900' })).not.toContain('PDF');
	});

	it('aksi disabled dan petunjuk menyebut yang kurang', () => {
		const body = html({ waNumber: '6282120209900', selected: ['offroad'], pax: '40', team: '', whatsapp: '081234567890' });
		expect(body).toContain('Lengkapi dulu: nama tim.');
		expect(body).toMatch(/<button[^>]*\sdisabled=""/);
	});

	it('petunjuk menyebut semua yang kurang', () => {
		const body = html();
		expect(body).toContain('Lengkapi dulu: nama tim, minimal satu paket, jumlah peserta yang valid, nomor WhatsApp yang valid.');
	});

	it('aksi aktif dan total tampil bila masukan lengkap', () => {
		const body = html({ waNumber: '6282120209900', selected: ['offroad'], pax: '40', team: 'Tim Alfa', whatsapp: '081234567890' });
		expect(body).toContain('Rp 10.000.000');
		expect(body).toContain('40 × Rp 250.000');
		expect(body).not.toContain('Lengkapi dulu');
		const button = body.match(/<button[^>]*>[\s\S]*?Kirim ke WhatsApp/)?.[0] ?? '';
		expect(button).not.toMatch(/\sdisabled(=|"|\s|>)/);
	});

	it('beberapa paket: subtotal dan total dijumlahkan', () => {
		const body = html({ selected: ['offroad', 'paintball'], pax: '40', team: 'x' });
		expect(body).toContain('Rp 10.000.000');
		expect(body).toContain('Rp 6.000.000');
		expect(body).toContain('Rp 16.000.000');
	});

	it('minimal peserta ditagihkan dan dijelaskan', () => {
		const body = html({ selected: ['rafting'], pax: '4', team: 'x' });
		expect(body).toContain('ditagihkan minimal 10 peserta');
		expect(body).toContain('Rp 2.000.000');
	});

	it('sebagian tanpa harga: catatan di samping total', () => {
		const body = html({ selected: ['offroad', 'fun-games'], pax: '40', team: 'x' });
		expect(body).toContain('belum termasuk paket tanpa harga');
		expect(body).toContain('Rp 10.000.000');
	});

	it('semua tanpa harga: "Dibahas via WhatsApp"', () => {
		const body = html({ selected: ['fun-games'], pax: '40', team: 'x' });
		expect(body).toContain('Dibahas via WhatsApp');
	});

	it.each(['0', '-3', '2.5', '10001', 'abc'])('peserta %j: pesan kesalahan dan tanpa total', (pax) => {
		const body = html({ selected: ['offroad'], pax, team: 'x' });
		expect(body).toContain('Masukkan bilangan bulat 1 sampai 10.000.');
		expect(body).toContain('aria-invalid="true"');
		expect(body).toContain('Isi jumlah peserta');
		expect(body).not.toContain('Rp 10.000.000');
	});

	it('peserta kosong: "Isi jumlah peserta" tanpa pesan kesalahan', () => {
		const body = html({ selected: ['offroad'], pax: '', team: 'x' });
		expect(body).toContain('Isi jumlah peserta');
		expect(body).not.toContain('Masukkan bilangan bulat');
	});

	it('total berada di wilayah aria-live', () => {
		expect(html()).toMatch(/aria-live="polite"[^>]*aria-atomic="true"/);
	});
});

describe('pilihan bersama: tab Paket ↔ kalkulator', () => {
	it('tombol panel: "Tambah ke trip" bila belum dipilih, "Hapus dari trip" + aria-pressed bila dipilih', () => {
		const belum = html();
		expect(count(belum, /aria-pressed="false"/g)).toBe(4);
		expect(belum).toContain('Tambah ke trip');
		expect(belum).not.toContain('Hapus dari trip');

		const sudah = html({ selected: ['rafting'] });
		expect(count(sudah, /aria-pressed="true"/g)).toBe(1);
		expect(sudah).toContain('Hapus dari trip');
		expect(count(sudah, /aria-pressed="false"/g)).toBe(3);
	});

	it('checkbox terpilih mengikuti state', () => {
		const body = html({ selected: ['rafting', 'paintball'] });
		expect(count(body, /type="checkbox"[^>]*checked/g)).toBe(2);
	});

	it('tab terpilih diberi penanda; tab lain tidak', () => {
		const body = html({ selected: ['offroad', 'rafting'] });
		expect(count(body, /\(dipilih\)/g)).toBe(2);
		const tabs = body.match(/<button[^>]*role="tab"[\s\S]*?<\/button>/g) ?? [];
		expect(tabs).toHaveLength(4);
		const marked = tabs.filter((t) => t.includes('(dipilih)'));
		expect(marked.map((t) => /Offroad|Rafting/.exec(t)?.[0]).sort()).toEqual(['Offroad', 'Rafting']);
		expect(tabs.filter((t) => !t.includes('(dipilih)'))).toHaveLength(2);
	});

	it('tanpa pilihan: tidak ada penanda', () => {
		expect(html()).not.toContain('(dipilih)');
	});

	it('pilihan usang diabaikan di ringkasan', () => {
		const body = html({ selected: ['sudah-dihapus'], pax: '40', team: 'x' });
		expect(body).toContain('Pilih minimal satu paket');
	});
});
