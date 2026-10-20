import type { Package } from './types';

export const MAX_PAX = 10000;

/** Jumlah peserta: bilangan bulat 1–10000 (string atau angka); selain itu null. */
export function parsePax(raw: string | number | null | undefined): number | null {
	const text = String(raw ?? '').trim();
	if (!/^\d+$/.test(text)) return null;
	const n = Number(text);
	return n >= 1 && n <= MAX_PAX ? n : null;
}

export type UnitCharge = {
	/** Nama satuan, misalnya "mobil". */
	name: string;
	capacity: number;
	/** ceil(peserta / kapasitas). */
	count: number;
	/** kapasitas × harga per orang. */
	price: number;
};

export type EstimateLine = {
	slug: string;
	title: string;
	/** Rupiah per orang; null = harga menyusul. */
	price: number | null;
	minPax: number;
	/** Orang yang ditagih: max(peserta, min_pax), atau kelipatan kapasitas pada mode per satuan. */
	billedPax: number;
	/** true bila min_pax lebih besar dari jumlah peserta yang diisi. */
	minApplied: boolean;
	/** null bila paket belum berharga. */
	subtotal: number | null;
	/** Terisi hanya pada mode per satuan yang berharga. */
	unit?: UnitCharge;
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

export function isUnitCapacity(value: number | null | undefined): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_PAX;
}

/** Nama satuan untuk rincian. Kosong menjadi "unit". */
export function unitLabel(name: string | null | undefined): string {
	const text = (name ?? '').trim().replace(/\s+/g, ' ');
	return text || 'unit';
}

export function usesUnitPricing(pkg: Pick<Package, 'pricing_mode' | 'kapasitas_per_unit'>): boolean {
	return pkg.pricing_mode === 'per_unit' && isUnitCapacity(pkg.kapasitas_per_unit);
}

/**
 * Tagihan per satuan: jumlah = ceil(peserta / kapasitas),
 * harga satuan = kapasitas × harga per orang, total = jumlah × harga satuan.
 * Mobil yang tidak penuh tetap ditagih penuh.
 */
export function perUnitQuote(pax: number, pricePerPerson: number, capacity: number): {
	units: number;
	unitPrice: number;
	billedPax: number;
	subtotal: number;
} {
	const units = Math.ceil(pax / capacity);
	const unitPrice = capacity * pricePerPerson;
	const billedPax = units * capacity;
	return { units, unitPrice, billedPax, subtotal: units * unitPrice };
}

export type ManualPrefill = {
	deskripsi: string;
	qty: string;
	harga: string;
	unitName: string;
	capacity: string;
};

/**
 * Isi baris invoice manual dari paket. Mode per satuan mengisi qty = jumlah satuan
 * dan harga = harga satu satuan penuh, plus nama satuan agar rinciannya tersimpan.
 */
export function manualPackagePrefill(
	pkg: {
		title: string;
		price: number | null;
		pricing_mode?: Package['pricing_mode'];
		kapasitas_per_unit?: number | null;
		nama_unit?: string | null;
	},
	paxText: string
): ManualPrefill {
	const parsed = parsePax(paxText);
	if (usesUnitPricing(pkg) && pkg.price !== null && isUnitCapacity(pkg.kapasitas_per_unit)) {
		const quote = perUnitQuote(parsed ?? 1, pkg.price, pkg.kapasitas_per_unit);
		return {
			deskripsi: pkg.title,
			qty: String(quote.units),
			harga: String(quote.unitPrice),
			unitName: unitLabel(pkg.nama_unit),
			capacity: String(pkg.kapasitas_per_unit)
		};
	}
	return {
		deskripsi: pkg.title,
		qty: paxText.trim() || '1',
		harga: pkg.price === null ? '' : String(pkg.price),
		unitName: '',
		capacity: ''
	};
}

/**
 * Estimasi trip. Mode per orang: `subtotal = harga × max(peserta, min_pax)`.
 * Mode per satuan: `subtotal = ceil(peserta / kapasitas) × (kapasitas × harga)`.
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
		const capacity = p.kapasitas_per_unit;
		if (p.pricing_mode === 'per_unit' && isUnitCapacity(capacity)) {
			const price = p.price_per_person;
			const quote = price === null ? null : perUnitQuote(pax, price, capacity);
			return {
				slug: p.slug,
				title: p.title,
				price,
				minPax: p.min_pax,
				billedPax: quote?.billedPax ?? pax,
				minApplied: false,
				subtotal: quote?.subtotal ?? null,
				...(quote
					? { unit: { name: unitLabel(p.nama_unit), capacity, count: quote.units, price: quote.unitPrice } }
					: {})
			};
		}
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
