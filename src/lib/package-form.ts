export const LIMITS = {
	title: 100,
	summary: 300,
	body: 5000,
	includes: 2000,
	notes: 2000,
	duration: 100,
	imageAlt: 200,
	maxPrice: 100_000_000,
	maxMinPax: 10_000
} as const;

export const PRICE_MESSAGE =
	'Isi harga dengan angka bulat, mis. 250000 atau 250.000. Kosongkan bila harga belum ditentukan.';
export const MIN_PAX_MESSAGE = 'Minimal peserta harus bilangan bulat 1 sampai 10.000.';
export const MODE_MESSAGE = 'Pilih cara hitung per orang atau per satuan.';
export const CAPACITY_MESSAGE = 'Kapasitas per satuan harus bilangan bulat 1 sampai 10.000.';
export const UNIT_NAME_MESSAGE = 'Isi nama satuan, misalnya mobil.';

export type PriceResult = { ok: true; value: number | null } | { ok: false };

/**
 * Harga per orang (rupiah). Diterima: `250000`, `250.000`, `Rp 250.000`, `Rp250000`; kosong → null.
 * Titik hanya boleh sebagai pemisah ribuan; `250.5` DITOLAK (bukan diam-diam menjadi 2505).
 */
export function parsePrice(raw: string): PriceResult {
	const text = raw.trim().replace(/^rp\.?\s*/i, '');
	if (text === '') return { ok: true, value: null };
	if (!/^\d+$/.test(text) && !/^\d{1,3}(\.\d{3})+$/.test(text)) return { ok: false };
	const value = Number(text.replaceAll('.', ''));
	return value >= 0 && value <= LIMITS.maxPrice ? { ok: true, value } : { ok: false };
}

export type MinPaxResult = { ok: true; value: number } | { ok: false };

/** Minimal peserta: bilangan bulat 1–10000; kosong → 1. */
export function parseMinPax(raw: string): MinPaxResult {
	const text = raw.trim();
	if (text === '') return { ok: true, value: 1 };
	if (!/^\d+$/.test(text)) return { ok: false };
	const value = Number(text);
	return value >= 1 && value <= LIMITS.maxMinPax ? { ok: true, value } : { ok: false };
}

/** Satu butir per baris; spasi tepi dan baris kosong dibuang. */
export function normalizeIncludes(raw: string): string {
	return raw
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.join('\n');
}

export type PricingMode = 'per_person' | 'per_unit';

export type PackageValues = {
	title: string;
	summary: string;
	body: string;
	includes: string;
	notes: string;
	duration: string | null;
	image_alt: string | null;
	price_per_person: number | null;
	min_pax: number;
	pricing_mode: PricingMode;
	kapasitas_per_unit: number | null;
	nama_unit: string | null;
	published: boolean;
};

export type FieldName =
	| 'title'
	| 'summary'
	| 'body'
	| 'includes'
	| 'notes'
	| 'duration'
	| 'image_alt'
	| 'price'
	| 'min_pax'
	| 'pricing_mode'
	| 'kapasitas_per_unit'
	| 'nama_unit';
export type PackageErrors = Partial<Record<FieldName, string>>;
/** Nilai mentah untuk mengisi ulang form setelah gagal. */
export type PackageRaw = Record<FieldName, string> & { published: boolean };

export type ParseResult =
	| { ok: true; values: PackageValues; raw: PackageRaw }
	| { ok: false; errors: PackageErrors; raw: PackageRaw };

type FormLike = { get(name: string): unknown };
/** Kotak centang HTML: ada (bernilai apa pun selain kosong) = tercentang; tidak dikirim = tidak. */
const isChecked = (v: unknown) => v !== null && v !== undefined && v !== '';
const text = (form: FormLike, name: string) => {
	const v = form.get(name);
	return typeof v === 'string' ? v.replace(/\r\n?/g, '\n') : '';
};

/** Validasi masukan form paket (tanpa berkas foto, yang ditangani terpisah). */
export function parsePackageForm(form: FormLike): ParseResult {
	const raw: PackageRaw = {
		title: text(form, 'title'),
		summary: text(form, 'summary'),
		body: text(form, 'body'),
		includes: text(form, 'includes'),
		notes: text(form, 'notes'),
		duration: text(form, 'duration'),
		image_alt: text(form, 'image_alt'),
		price: text(form, 'price'),
		min_pax: text(form, 'min_pax'),
		pricing_mode: text(form, 'pricing_mode'),
		kapasitas_per_unit: text(form, 'kapasitas_per_unit'),
		nama_unit: text(form, 'nama_unit'),
		published: isChecked(form.get('published'))
	};
	const errors: PackageErrors = {};

	const title = raw.title.trim();
	if (!title) errors.title = 'Nama paket wajib diisi.';
	else if (title.length > LIMITS.title) errors.title = `Nama paket maksimal ${LIMITS.title} karakter.`;

	const summary = raw.summary.trim();
	if (!summary) errors.summary = 'Ringkasan wajib diisi.';
	else if (summary.length > LIMITS.summary) errors.summary = `Ringkasan maksimal ${LIMITS.summary} karakter.`;

	const body = raw.body.trim();
	if (body.length > LIMITS.body) errors.body = `Penjelasan maksimal ${LIMITS.body} karakter.`;

	const includes = normalizeIncludes(raw.includes);
	if (includes.length > LIMITS.includes) errors.includes = `Fasilitas maksimal ${LIMITS.includes} karakter.`;

	const notes = raw.notes.trim();
	if (notes.length > LIMITS.notes) errors.notes = `Catatan maksimal ${LIMITS.notes} karakter.`;

	const duration = raw.duration.trim();
	if (duration.length > LIMITS.duration) errors.duration = `Durasi maksimal ${LIMITS.duration} karakter.`;

	const imageAlt = raw.image_alt.trim();
	if (imageAlt.length > LIMITS.imageAlt) errors.image_alt = `Teks alternatif maksimal ${LIMITS.imageAlt} karakter.`;

	const price = parsePrice(raw.price);
	if (!price.ok) errors.price = PRICE_MESSAGE;

	const minPax = parseMinPax(raw.min_pax);
	if (!minPax.ok) errors.min_pax = MIN_PAX_MESSAGE;

	const modeText = raw.pricing_mode.trim();
	const mode: PricingMode | null = modeText === '' || modeText === 'per_person' ? 'per_person' : modeText === 'per_unit' ? 'per_unit' : null;
	if (!mode) errors.pricing_mode = MODE_MESSAGE;

	let capacity: number | null = null;
	let unitName: string | null = null;
	if (mode === 'per_unit') {
		const parsedCapacity = parseCapacity(raw.kapasitas_per_unit);
		if (!parsedCapacity.ok) errors.kapasitas_per_unit = CAPACITY_MESSAGE;
		else capacity = parsedCapacity.value;
		const parsedName = parseUnitName(raw.nama_unit);
		if (!parsedName.ok) errors.nama_unit = UNIT_NAME_MESSAGE;
		else unitName = parsedName.value;
	}

	if (Object.keys(errors).length > 0 || !price.ok || !minPax.ok || !mode) return { ok: false, errors, raw };
	return {
		ok: true,
		raw,
		values: {
			title,
			summary,
			body,
			includes,
			notes,
			duration: duration || null,
			image_alt: imageAlt || null,
			price_per_person: price.value,
			min_pax: minPax.value,
			pricing_mode: mode,
			kapasitas_per_unit: capacity,
			nama_unit: unitName,
			published: raw.published
		}
	};
}

/** Kapasitas satu satuan: bilangan bulat 1–10000. Kosong ditolak. */
export function parseCapacity(raw: string): { ok: true; value: number } | { ok: false } {
	const text = raw.trim();
	if (!/^\d+$/.test(text)) return { ok: false };
	const value = Number(text);
	return value >= 1 && value <= LIMITS.maxMinPax ? { ok: true, value } : { ok: false };
}

/** Nama satuan untuk rincian, misalnya "mobil". */
export function parseUnitName(raw: string): { ok: true; value: string } | { ok: false } {
	const text = raw.trim().replace(/\s+/g, ' ');
	if (!text || text.length > 40) return { ok: false };
	return { ok: true, value: text };
}

/** Isian form dari paket tersimpan (halaman ubah). */
export function rawFromPackage(p: {
	title: string;
	summary: string;
	body: string;
	includes: string;
	notes: string;
	duration: string | null;
	image_alt: string | null;
	price_per_person: number | null;
	min_pax: number;
	pricing_mode?: string | null;
	kapasitas_per_unit?: number | null;
	nama_unit?: string | null;
	published: number;
}): PackageRaw {
	return {
		title: p.title,
		summary: p.summary,
		body: p.body,
		includes: p.includes,
		notes: p.notes,
		duration: p.duration ?? '',
		image_alt: p.image_alt ?? '',
		price: p.price_per_person === null ? '' : String(p.price_per_person),
		min_pax: String(p.min_pax),
		pricing_mode: p.pricing_mode === 'per_unit' ? 'per_unit' : 'per_person',
		kapasitas_per_unit: p.kapasitas_per_unit ? String(p.kapasitas_per_unit) : '',
		nama_unit: p.nama_unit ?? '',
		published: p.published === 1
	};
}

export const emptyRaw = (): PackageRaw => ({
	title: '', summary: '', body: '', includes: '', notes: '', duration: '', image_alt: '', price: '', min_pax: '',
	pricing_mode: 'per_person', kapasitas_per_unit: '', nama_unit: '', published: false
});
