import { formatRupiah } from './format';
import { DEFAULT_WA_MESSAGE } from './whatsapp';
import type { Estimate, EstimateLine } from './pricing';

export const WA_GREETING = DEFAULT_WA_MESSAGE;
export const DISCLAIMER =
	'Estimasi, bukan penawaran final. Harga dan ketersediaan dikonfirmasi saat konsultasi.';

export type EstimateInput = {
	team: string;
	/** Nomor WhatsApp ternormalisasi (62…) atau kosong. */
	whatsapp?: string;
	/** Jumlah peserta yang sudah valid. */
	pax: number;
	estimate: Estimate;
	/** yyyy-mm-dd atau kosong. */
	planDate: string;
	notes: string;
};

/** "2026-11-20" → "20 November 2026"; kosong/tidak valid → "". */
export function formatPlanDate(iso: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
	// T12:00:00 mencegah pergeseran hari karena zona waktu.
	const d = new Date(`${iso}T12:00:00`);
	return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(d);
}

/** Teks total untuk UI, PDF, dan pesan. */
export function totalText(e: Estimate): string {
	return e.state === 'quote-only' ? 'Dibahas via WhatsApp' : formatRupiah(e.total);
}

/** Catatan tambahan di samping total ("" bila tidak perlu). */
export function totalNote(e: Estimate): string {
	return e.state === 'partial' ? 'belum termasuk paket tanpa harga' : '';
}

/** Rincian satu baris: "40 x Rp 250.000 = Rp 10.000.000" atau "Harga menyusul". */
export function lineText(l: EstimateLine): string {
	if (l.price === null || l.subtotal === null) return 'Harga menyusul';
	const base = `${l.billedPax} x ${formatRupiah(l.price)} = ${formatRupiah(l.subtotal)}`;
	return l.minApplied ? `${base} (minimal ${l.minPax} peserta)` : base;
}

/** estimasi-trip-<nama-tim>-<yyyy-mm-dd>.pdf; nama tim di-slug, kosong → "tim". */
export function pdfFilename(team: string, today: Date): string {
	const slug =
		team
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40)
			.replace(/-+$/g, '') || 'tim';
	const y = today.getFullYear();
	const m = String(today.getMonth() + 1).padStart(2, '0');
	const d = String(today.getDate()).padStart(2, '0');
	return `estimasi-trip-${slug}-${y}-${m}-${d}.pdf`;
}

const TYPOGRAPHIC: Record<string, string> = {
	'–': '-',
	'—': '-',
	'‘': "'",
	'’': "'",
	'“': '"',
	'”': '"',
	'…': '...'
};

/**
 * Saring teks untuk font standar PDF (Latin-1): tanda baca tipografis → ASCII,
 * karakter lain di luar Latin-1 (emoji, aksara lain) → "?" satu per karakter.
 */
export function sanitizePdfText(text: string): string {
	return text
		.replace(/\r\n?/g, '\n')
		.replace(/\t/g, ' ')
		.replace(/[–—‘’“”…]/g, (c) => TYPOGRAPHIC[c])
		.replace(/[^\n\x20-\x7E\xA0-\xFF]/gu, '?');
}

/** Ringkasan teks untuk WhatsApp. */
export function buildWhatsappMessage(input: EstimateInput): string {
	const { estimate: e } = input;
	const date = formatPlanDate(input.planDate) || 'Belum ditentukan';
	const note = totalNote(e);
	const total = `${totalText(e)}${note ? ` (${note})` : ''}`;
	return [
		WA_GREETING,
		'',
		`Nama tim: ${input.team.trim()}`,
		...(input.whatsapp ? [`Nomor WhatsApp: +${input.whatsapp}`] : []),
		'Paket:',
		...e.lines.map((l) => `- ${l.title}: ${lineText(l)}`),
		`Peserta: ${input.pax} orang`,
		`Tanggal rencana: ${date}`,
		`Estimasi total: ${total}`,
		`Catatan: ${input.notes.trim() || '-'}`,
		'',
		'Mohon dibantu penawarannya. Saya lampirkan PDF estimasinya.'
	].join('\n');
}
