import { formatRupiah } from './format.js';
import type { Package } from './types.js';

/** Kalimat tab dan halaman paket. Include/exclude mengikuti konfirmasi pemilik. */
export type PackageStory = {
	paragraphs: string[];
	includes: string[];
	excludes: string[];
};

const AUDIENCE = 'perusahaan, kantor, sekolah, dan rombongan';
const EXCLUDES = ['Transport', 'Makan', 'Dokumentasi'];
const ADDON = 'Dokumentasi dan makan siang Liwet tersedia sebagai tambahan di kalkulator estimasi.';

type StorySource = Pick<
	Package,
	'slug' | 'price_per_person' | 'min_pax' | 'duration' | 'kapasitas_per_unit' | 'nama_unit'
>;

function money(p: StorySource, unit: string): string {
	const price = p.price_per_person === null ? 'Harga menyusul.' : `Harga ${formatRupiah(p.price_per_person)} ${unit}.`;
	return `${price} Minimal ${p.min_pax} peserta.`;
}

/**
 * Teks jawaban untuk lima paket bawaan.
 * Butir Include/Exclude memakai daftar yang dikonfirmasi pemilik.
 */
export function packageStory(p: StorySource): PackageStory | null {
	switch (p.slug) {
		case 'offroad':
			return {
				paragraphs: [
					`Offroad di Cikole, Lembang, Bandung, adalah kegiatan menyusuri jalur hutan dengan Land Rover untuk ${AUDIENCE}.`,
					`Titik kumpul Cikole, bisa juga start dari hotel area Lembang. Maksimal 7 orang per mobil. ${money(p, 'per mobil')} ${ADDON}`
				],
				includes: [
					'Durasi 1–3 jam',
					'Land Rover',
					'Supir berpengalaman',
					'Tiket masuk Cikole',
					'Air mineral',
					'P3K',
					'Asuransi',
					'Coffee break'
				],
				excludes: EXCLUDES
			};
		case 'team-building':
			return {
				paragraphs: [
					`Team building di Lembang, Bandung, adalah kegiatan untuk membangun kekompakan ${AUDIENCE}.`,
					`Titik kumpul kegiatan di Cikole. Bisa request di villa/hotel tempat menginap. ${money(p, 'per orang')} ${ADDON}`
				],
				includes: [
					'Game master',
					'Fasilitator',
					'Sound system',
					'Area',
					'Beragam jenis permainan untuk membangun kekompakan'
				],
				excludes: EXCLUDES
			};
		case 'rafting':
			return {
				paragraphs: [
					`Rafting di Ciater, Lembang, Bandung, adalah arung jeram untuk ${AUDIENCE}.`,
					`Titik kumpul kegiatan di Cikole. ${money(p, 'per orang')} ${ADDON}`
				],
				includes: ['Lokasi Ciater', 'Peralatan rafting', 'Pemandu', 'Durasi 20–30 menit'],
				excludes: EXCLUDES
			};
		case 'paintball':
			return {
				paragraphs: [
					`Paintball di Cikole, Lembang, Bandung, adalah permainan strategi kelompok untuk ${AUDIENCE}.`,
					`Titik kumpul kegiatan di Cikole. Paket mencakup 40 peluru. ${money(p, 'per orang')} ${ADDON}`
				],
				includes: ['Pemandu', '40 peluru', 'Perlengkapan paintball', 'Area bermain'],
				excludes: EXCLUDES
			};
		case 'fun-games':
			return {
				paragraphs: [
					`Fun games di Lembang, Bandung, adalah permainan kelompok untuk ${AUDIENCE}.`,
					`Titik kumpul kegiatan di Cikole. Bisa request dilakukan di villa/hotel tempat menginap. ${money(p, 'per orang')} ${ADDON}`
				],
				includes: ['Pemandu', 'Sound system'],
				excludes: EXCLUDES
			};
		default:
			return null;
	}
}
