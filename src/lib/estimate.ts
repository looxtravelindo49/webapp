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

/** Total dibagi jumlah peserta yang diisi, dibulatkan ke rupiah. */
export function perPaxAmount(total: number, pax: number): number | null {
	if (!Number.isFinite(total) || !Number.isInteger(pax) || pax < 1) return null;
	return Math.round(total / pax);
}

/** "Rp 262.500 / peserta", atau "" bila total bukan angka. */
export function perPaxText(total: number | null, pax: number): string {
	if (total === null) return '';
	const amount = perPaxAmount(total, pax);
	return amount === null ? '' : `${formatRupiah(amount)} / peserta`;
}

/** Catatan tambahan di samping total ("" bila tidak perlu). */
export function totalNote(e: Estimate): string {
	return e.state === 'partial' ? 'belum termasuk paket tanpa harga' : '';
}

/** "3 mobil × Rp 1.743.000 (maks. 7 orang/mobil)". */
export function unitBreakdown(count: number, unitPrice: number, capacity: number, unitName: string): string {
	const n = (value: number) => value.toLocaleString('id-ID');
	return `${n(count)} ${unitName} × ${formatRupiah(unitPrice)} (maks. ${n(capacity)} orang/${unitName})`;
}

/** Rincian satu baris: "40 x Rp 250.000 = Rp 10.000.000", rincian per satuan, atau "Harga menyusul". */
export function lineText(l: EstimateLine): string {
	if (l.price === null || l.subtotal === null) return 'Harga menyusul';
	if (l.flat) return formatRupiah(l.subtotal);
	if (l.unit) return unitBreakdown(l.unit.count, l.unit.price, l.unit.capacity, l.unit.name);
	const base = `${l.billedPax} x ${formatRupiah(l.price)} = ${formatRupiah(l.subtotal)}`;
	return l.minApplied ? `${base} (minimal ${l.minPax} peserta)` : base;
}

