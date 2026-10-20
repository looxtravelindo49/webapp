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

const STATUS_LABEL: Record<string, string> = {
	draft: 'Draf',
	menunggu_konfirmasi: 'Menunggu konfirmasi',
	menunggu_dp: 'Menunggu DP',
	lunas_dp: 'DP lunas'
};

export function statusLabel(status: string): string {
	return STATUS_LABEL[status] ?? status;
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
