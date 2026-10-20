import { formatPlanDate, lineText, totalNote, totalText } from './estimate';
import type { Estimate, EstimateLine } from './pricing';

/** Persen uang muka. Satu sumber untuk hitungan, label, dan teks. Bukan biaya gateway. */
export const DP_PERCENT = 30;

/** Huruf tanpa 0/O/1/I supaya nomor mudah dibacakan. Panjang 32, habis membagi 256. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const INVOICE_NUMBER = /^LA-\d{8}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export type StoredLine = {
	slug: string;
	title: string;
	price: number | null;
	minPax: number;
	billedPax: number;
	subtotal: number | null;
	/** `bebas` = baris invoice manual (qty × harga satuan). Selain itu baris paket kalkulator. */
	kind?: 'paket' | 'bebas';
	/** Cuplikan mode per satuan, supaya rincian invoice tidak bergantung pada pengaturan paket yang berubah. */
	pricingMode?: 'per_unit';
	units?: number;
	unitPrice?: number;
	capacity?: number;
	unitName?: string;
};

/** Tanggal kalender WIB `YYYYMMDD` untuk nomor invoice. */
export function invoiceStamp(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jakarta',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
	return `${pick('year')}${pick('month')}${pick('day')}`;
}

/** 8 byte acak → 8 karakter. Modulo aman karena 256 habis dibagi panjang alfabet. */
export function suffixFromBytes(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < 8; i++) out += ALPHABET[(bytes[i] ?? 0) % ALPHABET.length];
	return out;
}

export function buildInvoiceNumber(date: Date, bytes: Uint8Array): string {
	return `LA-${invoiceStamp(date)}-${suffixFromBytes(bytes)}`;
}

/** DP_PERCENT dari estimasi, dibulatkan ke rupiah. `null` bila estimasi belum berupa angka. */
export function dpNominal(total: number | null): number | null {
	if (total === null) return null;
	return Math.round((total * DP_PERCENT) / 100);
}

/**
 * Nominal DP yang ditampilkan. Lead lama boleh masih menyimpan hasil persen sebelumnya;
 * kalau angka itu persis turunan `storedPercent` × total, hitung ulang dengan DP_PERCENT.
 * Nominal yang bukan turunan, dan semua jumlah yang sudah dibayar, tidak diubah di sini.
 */
export function displayedDp(total: number | null, storedDp: number | null, storedPercent: number | null): number | null {
	if (total === null) return storedDp;
	const current = dpNominal(total);
	if (storedDp === null || storedDp === current) return current;
	if (storedPercent !== null && Number.isInteger(storedPercent) && storedDp === Math.round((total * storedPercent) / 100)) {
		return current;
	}
	return storedDp;
}

export function storedLinesFromEstimate(lines: readonly EstimateLine[]): StoredLine[] {
	return lines.map((l) => {
		const row: StoredLine = {
			slug: l.slug,
			title: l.title,
			price: l.price,
			minPax: l.minPax,
			billedPax: l.billedPax,
			subtotal: l.subtotal,
			kind: 'paket'
		};
		if (l.unit) {
			row.pricingMode = 'per_unit';
			row.units = l.unit.count;
			row.unitPrice = l.unit.price;
			row.capacity = l.unit.capacity;
			row.unitName = l.unit.name;
		}
		return row;
	});
}

export function parseStoredLines(raw: string): StoredLine[] {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	const lines: StoredLine[] = [];
	for (const item of data) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const title = typeof row.title === 'string' ? row.title : '';
		if (!title) continue;
		const price = row.price === null ? null : Number(row.price);
		const subtotal = row.subtotal === null ? null : Number(row.subtotal);
		const line: StoredLine = {
			slug: typeof row.slug === 'string' ? row.slug : '',
			title,
			price: price === null || Number.isFinite(price) ? price : null,
			minPax: Number(row.minPax) || 1,
			billedPax: Number(row.billedPax) || 0,
			subtotal: subtotal === null || Number.isFinite(subtotal) ? subtotal : null,
			kind: row.kind === 'bebas' ? 'bebas' : 'paket'
		};
		const units = Number(row.units);
		const unitPrice = Number(row.unitPrice);
		const capacity = Number(row.capacity);
		const unitName = typeof row.unitName === 'string' ? row.unitName.trim() : '';
		if (
			row.pricingMode === 'per_unit' &&
			Number.isInteger(units) && units >= 1 &&
			Number.isInteger(unitPrice) && unitPrice >= 0 &&
			Number.isInteger(capacity) && capacity >= 1 &&
			unitName
		) {
			line.pricingMode = 'per_unit';
			line.units = units;
			line.unitPrice = unitPrice;
			line.capacity = capacity;
			line.unitName = unitName;
		}
		lines.push(line);
	}
	return lines;
}

export function estimateFromStored(lines: readonly StoredLine[], total: number | null): Estimate {
	const mapped: EstimateLine[] = lines.map((l) => ({
		slug: l.slug,
		title: l.title,
		price: l.price,
		minPax: l.minPax,
		billedPax: l.billedPax,
		minApplied: false,
		subtotal: l.subtotal,
		...(l.pricingMode === 'per_unit' && l.units && l.unitPrice !== undefined && l.capacity && l.unitName
			? { unit: { name: l.unitName, capacity: l.capacity, count: l.units, price: l.unitPrice } }
			: {})
	}));
	const unpricedCount = lines.filter((l) => l.subtotal === null).length;
	const pricedCount = lines.length - unpricedCount;
	const state: Estimate['state'] =
		lines.length === 0 ? 'empty' : pricedCount === 0 ? 'quote-only' : unpricedCount > 0 ? 'partial' : 'complete';
	return { state, lines: mapped, total: total ?? 0, pricedCount, unpricedCount };
}

/** Status konfirmasi manual. Bukan urutan angka, dan bukan status Xendit. */
export const LEAD_STATUSES = ['baru', 'dp_diterima', 'lunas', 'batal'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const STATUS_LABEL: Record<LeadStatus, string> = {
	baru: 'Baru',
	dp_diterima: 'DP diterima',
	lunas: 'Lunas',
	batal: 'Batal'
};

export function isLeadStatus(value: string): value is LeadStatus {
	return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function statusLabel(status: string): string {
	return isLeadStatus(status) ? STATUS_LABEL[status] : status;
}

/** Judul, lencana, dan apakah ajakan bayar DP masih tampil. Status dibaca dari database, bukan dari cache. */
export function invoiceChrome(status: string): { title: string; badge: string; stamp: boolean; showPayCta: boolean } {
	if (status === 'lunas') return { title: 'Invoice Lunas', badge: 'LUNAS', stamp: true, showPayCta: false };
	if (status === 'dp_diterima') return { title: 'Invoice', badge: 'DP diterima', stamp: false, showPayCta: false };
	if (status === 'batal') return { title: 'Invoice', badge: 'Dibatalkan', stamp: false, showPayCta: false };
	return { title: 'Invoice Estimasi', badge: 'Baru', stamp: false, showPayCta: true };
}

/** Nominal DP yang sudah masuk, dan sisa terhadap total. `null` bila angkanya belum ada. */
export function settlement(
	total: number | null,
	dp: number | null,
	received: number | null
): { paid: number | null; remaining: number | null } {
	const paid = received ?? dp;
	if (paid === null) return { paid: null, remaining: null };
	if (total === null) return { paid, remaining: null };
	return { paid, remaining: Math.max(0, total - paid) };
}

export type ManualQuote = { subtotal: number; diskon: number; total: number; dp: number };

/** Total invoice manual dari qty × harga satuan, dikurangi diskon. `null` bila angkanya tidak sah. */
export function manualQuote(lines: readonly { qty: number; harga: number }[], diskon: number): ManualQuote | null {
	if (lines.length === 0) return null;
	let subtotal = 0;
	for (const line of lines) {
		if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 10_000) return null;
		if (!Number.isInteger(line.harga) || line.harga < 0 || line.harga > MAX_RECEIVED) return null;
		const row = line.qty * line.harga;
		if (!Number.isSafeInteger(row)) return null;
		subtotal += row;
		if (subtotal > MAX_RECEIVED) return null;
	}
	if (!Number.isInteger(diskon) || diskon < 0 || diskon > subtotal) return null;
	const total = subtotal - diskon;
	return { subtotal, diskon, total, dp: dpNominal(total) ?? 0 };
}

/** Pesan ke WhatsApp klien, nomor invoice dan tautannya sudah terisi. */
export function buildClientInvoiceMessage(input: {
	nama: string;
	nomor: string;
	total: string;
	dp: string;
	invoiceUrl: string;
}): string {
	return [
		`Halo ${input.nama.trim()}, ini invoice dari Lembang Adventures.`,
		'',
		`Nomor invoice: ${input.nomor}`,
		`Total: ${input.total}`,
		`DP ${DP_PERCENT}%: ${input.dp}`,
		'',
		`Link invoice: ${input.invoiceUrl}`,
		'',
		'Kalau sudah transfer, balas chat ini dengan bukti transfernya, ya.'
	].join('\n');
}

/** Lencana admin. Tanggal hanya untuk DP diterima dan Lunas. */
export function paymentBadge(status: string, diterimaPada: string | null): string {
	const label = statusLabel(status);
	if ((status === 'dp_diterima' || status === 'lunas') && diterimaPada) {
		const pretty = formatPlanDate(diterimaPada);
		if (pretty) return `${label} · ${pretty}`;
	}
	return label;
}

/** Pesan bukti transfer. Hanya nomor invoice, tanpa data lain. */
export function buildPaymentProofMessage(nomor: string): string {
	return [
		'Halo Lembang Adventures, aku sudah transfer untuk invoice ini.',
		'',
		`Nomor invoice: ${nomor}`,
		'',
		'Bukti transfernya aku kirim di chat ini, ya.'
	].join('\n');
}

/** Tanggal kalender hari ini di WIB, `YYYY-MM-DD`. */
export function todayInJakarta(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Asia/Jakarta',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

/** `YYYY-MM-DD` yang tidak bergeser (2026-02-31 ditolak). */
export function isIsoDate(raw: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
	const [y, m, d] = raw.split('-').map(Number);
	const date = new Date(`${raw}T12:00:00`);
	return date.getFullYear() === y && date.getMonth() + 1 === m && date.getDate() === d;
}

const MAX_RECEIVED = 10_000_000_000;

/**
 * Nominal yang dicatat admin. Kosong → null (tidak diubah).
 * `1500000`, `1.500.000`, atau `Rp 1.500.000`. Bukan pecahan.
 */
export function parseReceivedAmount(raw: string): { ok: true; value: number | null } | { ok: false } {
	const text = raw.trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, '');
	if (text === '') return { ok: true, value: null };
	if (!/^\d+$/.test(text) && !/^\d{1,3}(\.\d{3})+$/.test(text)) return { ok: false };
	const value = Number(text.replaceAll('.', ''));
	if (!Number.isSafeInteger(value) || value < 0 || value > MAX_RECEIVED) return { ok: false };
	return { ok: true, value };
}

export type ConfirmationInput = {
	nama: string;
	whatsapp: string;
	titles: string[];
	pax: number;
	planDate: string;
	estimate: Estimate;
	notes: string;
	invoiceUrl: string;
};

/** Pesan konfirmasi untuk wa.me. Tidak menyebut PDF. */
export function buildConfirmationMessage(input: ConfirmationInput): string {
	const note = totalNote(input.estimate);
	const estimasi = `${totalText(input.estimate)}${note ? ` (${note})` : ''}`;
	const date = formatPlanDate(input.planDate) || 'Belum ditentukan';
	const lines = [
		'Halo Lembang Adventures, aku barusan hitung di kalkulator website.',
		'',
		`Nama: ${input.nama.trim()}`,
		`Nomor WhatsApp: +${input.whatsapp}`,
		`Paket: ${input.titles.filter(Boolean).join(', ')}`,
		`Jumlah peserta: ${input.pax} orang`,
		`Tanggal: ${date}`,
		`Estimasi: ${estimasi}`
	];
	for (const line of input.estimate.lines) {
		if (!line.unit || line.subtotal === null) continue;
		lines.push(`${line.title}: ${lineText(line)}`);
	}
	const catatan = input.notes.trim();
	if (catatan) lines.push(`Catatan: ${catatan}`);
	lines.push('', `Link invoice: ${input.invoiceUrl}`, '', 'Boleh dicek tanggalnya masih bisa atau tidak, sekalian konfirmasi harga finalnya?');
	return lines.join('\n');
}
