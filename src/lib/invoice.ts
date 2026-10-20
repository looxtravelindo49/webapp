import { formatPlanDate, totalNote, totalText } from './estimate';
import type { Estimate, EstimateLine } from './pricing';

/** Persen uang muka. Nominal dihitung di server dari estimasi; bukan biaya gateway. */
export const DP_PERCENT = 20;

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

/** 20% dari estimasi, dibulatkan ke rupiah. `null` bila estimasi belum berupa angka. */
export function dpNominal(total: number | null): number | null {
	if (total === null) return null;
	return Math.round((total * DP_PERCENT) / 100);
}

export function storedLinesFromEstimate(lines: readonly EstimateLine[]): StoredLine[] {
	return lines.map((l) => ({
		slug: l.slug,
		title: l.title,
		price: l.price,
		minPax: l.minPax,
		billedPax: l.billedPax,
		subtotal: l.subtotal
	}));
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
		lines.push({
			slug: typeof row.slug === 'string' ? row.slug : '',
			title,
			price: price === null || Number.isFinite(price) ? price : null,
			minPax: Number(row.minPax) || 1,
			billedPax: Number(row.billedPax) || 0,
			subtotal: subtotal === null || Number.isFinite(subtotal) ? subtotal : null
		});
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
		subtotal: l.subtotal
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

/** Lencana publik. Tanggal hanya untuk DP diterima dan Lunas. */
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
	const catatan = input.notes.trim();
	if (catatan) lines.push(`Catatan: ${catatan}`);
	lines.push('', `Link invoice: ${input.invoiceUrl}`, '', 'Boleh dicek tanggalnya masih bisa atau tidak, sekalian konfirmasi harga finalnya?');
	return lines.join('\n');
}
