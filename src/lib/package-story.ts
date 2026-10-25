import { formatRupiah } from './format.js';
import { visibleDuration } from './package-display.js';
import type { Package } from './types.js';

/** Kalimat tab dan halaman paket. Hanya fakta yang sudah ada di data paket. */
export type PackageStory = {
	paragraphs: string[];
	includes: string[];
	excludes: string[];
};

const AUDIENCE = 'perusahaan, kantor, sekolah, dan rombongan';

type StorySource = Pick<
	Package,
	'slug' | 'price_per_person' | 'min_pax' | 'duration' | 'kapasitas_per_unit' | 'nama_unit'
>;

function money(p: StorySource, unit: string): string {
	const price = p.price_per_person === null ? 'Harga menyusul.' : `Harga ${formatRupiah(p.price_per_person)} ${unit}.`;
	return `${price} Minimal ${p.min_pax} peserta.`;
}

function withDuration(p: StorySource, lines: string[]): string[] {
	const duration = visibleDuration(p.duration);
	if (duration) lines.push(`Durasi kegiatan ${duration}.`);
	return lines;
}

/**
 * Teks jawaban untuk lima paket bawaan.
 * Butir Include/Exclude yang tidak tertulis di data paket tidak dimasukkan.
 */
export function packageStory(p: StorySource): PackageStory | null {
	switch (p.slug) {
		case 'offroad': {
			const unit = p.nama_unit?.trim() || 'mobil';
			const cap = p.kapasitas_per_unit;
			const capacity = cap && cap > 0 ? `Satu ${unit} memuat maksimal ${cap} orang.` : `Kegiatan memakai ${unit}.`;
			const includes = cap && cap > 0 ? [`Mobil offroad, maksimal ${cap} orang per ${unit}`] : ['Mobil offroad'];
			return {
				paragraphs: withDuration(p, [
					`Offroad di Cikole, Lembang, Bandung, adalah kegiatan menyusuri jalur hutan dengan mobil offroad untuk ${AUDIENCE}.`,
					`${capacity} ${money(p, 'per mobil')}`
				]),
				includes,
				excludes: []
			};
		}
		case 'team-building':
			return {
				paragraphs: withDuration(p, [
					`Team building di Cikole, Lembang, Bandung, adalah kegiatan untuk melatih komunikasi, kerja sama, dan kebersamaan ${AUDIENCE}.`,
					money(p, 'per orang')
				]),
				includes: [],
				excludes: []
			};
		case 'rafting':
			return {
				paragraphs: withDuration(p, [
					`Rafting adalah arung jeram untuk ${AUDIENCE} di kawasan Lembang dan Bandung. Peserta mendayung perahu karet mengikuti arahan pemandu. Lokasi sungai mengikuti konsultasi.`,
					money(p, 'per orang')
				]),
				includes: ['Perahu, dayung, dan perlengkapan keselamatan', 'Pemandu berpengalaman', 'Briefing sebelum mulai'],
				excludes: []
			};
		case 'paintball':
			return {
				paragraphs: withDuration(p, [
					`Paintball di Cikole, Lembang, Bandung, adalah permainan strategi kelompok untuk ${AUDIENCE}.`,
					p.price_per_person === null
						? `Harga menyusul. Paket sudah termasuk 40 peluru per orang. Minimal ${p.min_pax} peserta.`
						: `Harga ${formatRupiah(p.price_per_person)} per orang, sudah termasuk 40 peluru per orang. Minimal ${p.min_pax} peserta.`
				]),
				includes: ['Perlengkapan paintball dan pelindung', 'Isi 40 peluru per orang', 'Briefing aturan dan keselamatan'],
				excludes: []
			};
		case 'fun-games':
			return {
				paragraphs: withDuration(p, [
					`Fun games di Cikole, Lembang, Bandung, adalah permainan kelompok yang ringan untuk ${AUDIENCE}. Jenis permainan, durasi, dan lokasi mengikuti program yang disepakati.`,
					money(p, 'per orang')
				]),
				includes: [],
				excludes: []
			};
		default:
			return null;
	}
}
