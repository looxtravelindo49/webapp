import { formatRupiah } from './format';
import type { Estimate, EstimateLine } from './pricing';

export const DISCLAIMER =
	'Estimasi, bukan penawaran final. Harga dan ketersediaan dikonfirmasi saat konsultasi.';

/** "2026-11-20" → "20 November 2026"; kosong/tidak valid → "". */
export function formatPlanDate(iso: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
	// T12:00:00 mencegah pergeseran hari karena zona waktu.
	const d = new Date(`${iso}T12:00:00`);
	return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(d);
}

/** Teks total untuk UI dan pesan. */
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

