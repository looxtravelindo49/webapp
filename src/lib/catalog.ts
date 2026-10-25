import type { Package } from './types';

/** Sampul kartu Rafting yang disetujui (bukan foto galeri lama). */
export const RAFTING_CARD_IMAGE = '/media/rafting.webp';
export const RAFTING_CARD_ALT = 'Peserta rafting memakai rompi pelampung di tepi sungai';

export type CatalogFilterId = 'all' | 'adv' | 'grup' | 'corp';

export const CATALOG_FILTERS: { id: CatalogFilterId; label: string }[] = [
	{ id: 'all', label: 'Semua' },
	{ id: 'adv', label: 'Adventure' },
	{ id: 'grup', label: 'Untuk Grup' },
	{ id: 'corp', label: 'Corporate' }
];

type Profile = {
	badge: string;
	hot?: boolean;
	filter: Exclude<CatalogFilterId, 'all'>;
	location: string;
};

/** Badge, filter, dan baris lokasi untuk paket bawaan, sesuai mockup yang disetujui. */
const PROFILES: Record<string, Profile> = {
	offroad: { badge: 'Paling Dicari', hot: true, filter: 'adv', location: 'Cikole, Lembang · Setengah hari' },
	'team-building': { badge: 'Corporate', filter: 'corp', location: 'Cikole, Lembang · Setengah hari' },
	'fun-games': { badge: 'Untuk Grup', filter: 'grup', location: 'Cikole, Lembang · Sesuai program' },
	paintball: { badge: 'Adventure', filter: 'adv', location: 'Cikole, Lembang · Termasuk 40 peluru' },
	rafting: { badge: 'Outdoor', filter: 'adv', location: 'Ciater, Lembang' }
};

export function catalogProfile(slug: string): Profile | null {
	return PROFILES[slug] ?? null;
}

export function catalogMatches(slug: string, filter: CatalogFilterId): boolean {
	if (filter === 'all') return true;
	return PROFILES[slug]?.filter === filter;
}

export type CatalogPrice = { amount: string; unit: string | null };

/** "Rp249.000" + "/pax*" atau "/orang". Harga kosong → "Minta penawaran". */
export function catalogPrice(p: Pick<Package, 'price_per_person' | 'pricing_mode'>): CatalogPrice {
	const amount = p.price_per_person;
	if (amount === null || !Number.isInteger(amount) || amount < 0) return { amount: 'Minta penawaran', unit: null };
	return {
		amount: `Rp${new Intl.NumberFormat('id-ID').format(amount)}`,
		unit: p.pricing_mode === 'per_unit' ? '/pax*' : '/orang'
	};
}

export function catalogLocation(p: Pick<Package, 'slug' | 'duration'>): string {
	const known = PROFILES[p.slug];
	if (known) return known.location;
	const duration = p.duration?.trim();
	return duration ? `Lembang · ${duration}` : 'Lembang';
}

export function catalogImage(p: Pick<Package, 'slug' | 'cover_image' | 'image'>): string {
	if (p.slug === 'rafting') return RAFTING_CARD_IMAGE;
	return p.cover_image || p.image || '/media/forest.svg';
}

/** Alt kartu. Rafting memakai alt foto sampul yang disetujui. Selain itu alt galeri, lalu alt foto, lalu nama. */
export function catalogAlt(p: Pick<Package, 'slug' | 'title' | 'cover_image' | 'cover_alt' | 'image_alt'>): string {
	if (p.slug === 'rafting') return RAFTING_CARD_ALT;
	const fromCover = p.cover_image ? p.cover_alt?.trim() : p.image_alt?.trim();
	return fromCover || p.title;
}

/** Catatan asterisk untuk paket per satuan. Offroad memakai nama pendek seperti di mockup. */
export function unitPriceNote(
	p: Pick<Package, 'slug' | 'title' | 'pricing_mode' | 'kapasitas_per_unit' | 'nama_unit'>
): string | null {
	if (p.pricing_mode !== 'per_unit') return null;
	const cap = p.kapasitas_per_unit;
	const unit = p.nama_unit?.trim();
	if (!cap || !unit) return null;
	const name = p.slug === 'offroad' ? 'Offroad' : p.title;
	return `*${name} dihitung per ${unit} (maks. ${cap} orang/${unit}). Harga final dikonfirmasi via WhatsApp.`;
}
