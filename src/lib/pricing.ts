import type { Package } from './types';

export const MAX_PAX = 10000;

/** Jumlah peserta: bilangan bulat 1–10000 (string atau angka); selain itu null. */
export function parsePax(raw: string | number | null | undefined): number | null {
	const text = String(raw ?? '').trim();
	if (!/^\d+$/.test(text)) return null;
	const n = Number(text);
	return n >= 1 && n <= MAX_PAX ? n : null;
}

export type EstimateLine = {
	slug: string;
	title: string;
	/** Rupiah per orang; null = harga menyusul. */
	price: number | null;
	minPax: number;
	/** max(peserta, min_pax) */
	billedPax: number;
	/** true bila min_pax lebih besar dari jumlah peserta yang diisi. */
	minApplied: boolean;
	/** null bila paket belum berharga. */
	subtotal: number | null;
};

export type EstimateState =
	/** Belum ada paket terpilih. */
	| 'empty'
	/** Jumlah peserta belum valid. */
	| 'invalid-pax'
	/** Semua paket terpilih belum berharga. */
	| 'quote-only'
	/** Sebagian paket terpilih belum berharga. */
	| 'partial'
	| 'complete';

export type Estimate = {
	state: EstimateState;
	lines: EstimateLine[];
	/** Jumlah subtotal paket berharga (0 bila tidak ada). */
	total: number;
	pricedCount: number;
	unpricedCount: number;
};

/**
 * Estimasi trip: untuk tiap paket terpilih, `subtotal = harga × max(peserta, min_pax)`.
 * Urutan baris mengikuti urutan `packages`; slug yang tidak ada di `packages` diabaikan.
 */
export function calculateEstimate(
	packages: readonly Package[],
	selected: Iterable<string>,
	pax: number | null
): Estimate {
	const chosen = new Set(selected);
	const picked = packages.filter((p) => chosen.has(p.slug));
	if (picked.length === 0) {
		return { state: 'empty', lines: [], total: 0, pricedCount: 0, unpricedCount: 0 };
	}
	if (pax === null) {
		return { state: 'invalid-pax', lines: [], total: 0, pricedCount: 0, unpricedCount: 0 };
	}

	const lines: EstimateLine[] = picked.map((p) => {
		const billedPax = Math.max(pax, p.min_pax);
		return {
			slug: p.slug,
			title: p.title,
			price: p.price_per_person,
			minPax: p.min_pax,
			billedPax,
			minApplied: p.min_pax > pax,
			subtotal: p.price_per_person === null ? null : p.price_per_person * billedPax
		};
	});
	const priced = lines.filter((l) => l.subtotal !== null);
	const total = priced.reduce((sum, l) => sum + (l.subtotal ?? 0), 0);
	const unpricedCount = lines.length - priced.length;
	const state: EstimateState =
		priced.length === 0 ? 'quote-only' : unpricedCount > 0 ? 'partial' : 'complete';
	return { state, lines, total, pricedCount: priced.length, unpricedCount };
}
