import { formatRupiah } from './format';
import type { Estimate, EstimateLine } from './pricing';

export type AddonId = 'liwet' | 'dok-basic' | 'dok-pro';

export type Addon = {
	id: AddonId;
	title: string;
	/** `per_pax` memakai jumlah peserta yang diisi, bukan minimal tagihan paket. */
	mode: 'per_pax' | 'flat';
	price: number;
	/** Anggota grup yang sama tidak bisa dipilih bersamaan. */
	group?: 'dokumentasi';
};

export const ADDONS: readonly Addon[] = [
	{ id: 'liwet', title: 'Makan siang Liwet di hutan', mode: 'per_pax', price: 50_000 },
	{
		id: 'dok-basic',
		title: 'Dokumentasi Basic (Foto & Video cinematic, 4 jam)',
		mode: 'flat',
		price: 700_000,
		group: 'dokumentasi'
	},
	{
		id: 'dok-pro',
		title: 'Dokumentasi Pro (Foto + Video + Drone, 4 jam)',
		mode: 'flat',
		price: 1_500_000,
		group: 'dokumentasi'
	}
];

const BY_ID = new Map(ADDONS.map((addon) => [addon.id, addon]));

export function isAddonId(value: string): value is AddonId {
	return BY_ID.has(value as AddonId);
}

export function addonPriceLabel(addon: Addon): string {
	return addon.mode === 'per_pax' ? `${formatRupiah(addon.price)} / orang` : formatRupiah(addon.price);
}

/**
 * Id yang dikenali, tanpa duplikat, urut seperti katalog tambahan.
 * Dalam satu grup, yang terakhir di daftar masukan yang dipakai.
 */
export function normalizeAddonIds(raw: Iterable<unknown>): AddonId[] {
	const picked: AddonId[] = [];
	for (const item of raw) {
		if (typeof item !== 'string' || !isAddonId(item)) continue;
		const addon = BY_ID.get(item)!;
		const rest = picked.filter((id) => {
			if (id === addon.id) return false;
			const other = BY_ID.get(id)!;
			return !(addon.group && other.group === addon.group);
		});
		picked.length = 0;
		picked.push(...rest, addon.id);
	}
	return ADDONS.map((addon) => addon.id).filter((id) => picked.includes(id));
}

/** Tambahkan baris tambahan ke estimasi yang sudah punya paket dan peserta valid. Harga dihitung di sini, bukan dari klien. */
export function withAddons(estimate: Estimate, rawIds: Iterable<unknown>, pax: number | null): Estimate {
	if (estimate.state === 'empty' || estimate.state === 'invalid-pax' || pax === null) return estimate;
	const ids = normalizeAddonIds(rawIds);
	if (ids.length === 0) return estimate;
	const extra: EstimateLine[] = ids.map((id) => {
		const addon = BY_ID.get(id)!;
		const flat = addon.mode === 'flat';
		const billedPax = flat ? 1 : pax;
		return {
			slug: `addon-${addon.id}`,
			title: addon.title,
			price: addon.price,
			minPax: 1,
			billedPax,
			minApplied: false,
			subtotal: addon.price * billedPax,
			addon: true,
			...(flat ? { flat: true } : {})
		};
	});
	const lines = [...estimate.lines, ...extra];
	const priced = lines.filter((line) => line.subtotal !== null);
	const unpricedCount = lines.length - priced.length;
	const state: Estimate['state'] = priced.length === 0 ? 'quote-only' : unpricedCount > 0 ? 'partial' : 'complete';
	return {
		state,
		lines,
		total: priced.reduce((sum, line) => sum + (line.subtotal ?? 0), 0),
		pricedCount: priced.length,
		unpricedCount
	};
}
