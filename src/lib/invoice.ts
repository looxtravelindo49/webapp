import { formatPlanDate, lineText, perPaxAmount, totalNote, totalText } from './estimate';
import { formatRupiah } from './format';
import type { Estimate, EstimateLine } from './pricing';

/** Persen uang muka. Satu sumber untuk hitungan, label, dan teks. Bukan biaya gateway. */
export const DP_PERCENT = 30;

/** Judul bawaan baris jasa. Admin boleh menggantinya. */
export const DEFAULT_FEE_LABEL = 'Fee Services';

export const MAX_FEE_LABEL = 80;
export const MAX_INCLUDES = 2000;

/** `persen` = persen dikunci. `nominal` = rupiah dikunci. `null` = aturan lama (boleh diselaraskan ke DP_PERCENT). */
export type DpMode = 'persen' | 'nominal';

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
	/** `bebas` = baris invoice manual. `addon` = tambahan kalkulator. `fee` = jasa (bukan paket). Selain itu baris paket. */
	kind?: 'paket' | 'bebas' | 'addon' | 'fee';
	/** Harga tetap, tidak dikali peserta. */
	flat?: boolean;
	/** Cuplikan mode per satuan, supaya rincian invoice tidak bergantung pada pengaturan paket yang berubah. */
	pricingMode?: 'per_unit';
	units?: number;
	unitPrice?: number;
	capacity?: number;
	unitName?: string;
	/** Catatan Include, satu butir per baris. Kosong pada invoice lama. */
	includes?: string;
	/** Cara hitung baris fee. `feeRate` persen = perseratus persen (1000 = 10,00%). Nominal = rupiah. */
	feeMode?: 'persen' | 'nominal';
	feeRate?: number;
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
 * `dpMode` yang dikunci admin tidak diselaraskan: persen dihitung ulang dari total, nominal tetap.
 */
export function displayedDp(
	total: number | null,
	storedDp: number | null,
	storedPercent: number | null,
	dpMode: DpMode | null = null
): number | null {
	if (dpMode === 'nominal') return storedDp;
	if (dpMode === 'persen') {
		if (total === null || storedPercent === null || !Number.isInteger(storedPercent)) return storedDp;
		return Math.round((total * storedPercent) / 100);
	}
	if (total === null) return storedDp;
	const current = dpNominal(total);
	if (storedDp === null || storedDp === current) return current;
	if (storedPercent !== null && Number.isInteger(storedPercent) && storedDp === Math.round((total * storedPercent) / 100)) {
		return current;
	}
	return storedDp;
}

/** Label singkat DP untuk pesan dan ringkasan admin. */
export function dpCaption(mode: DpMode | null, persen: number | null): string {
	if (mode === 'nominal') return 'DP';
	const percent = mode === 'persen' && persen !== null ? persen : DP_PERCENT;
	return `DP ${percent}%`;
}

/** Label uang muka di invoice publik. */
export function dpInvoiceLabel(mode: DpMode | null, persen: number | null): string {
	if (mode === 'nominal') return 'Uang muka (DP)';
	const percent = mode === 'persen' && persen !== null ? persen : DP_PERCENT;
	return `Uang muka (DP) ${percent}%`;
}

/** Teks tombol bayar yang masih nonaktif. Invoice bawaan tetap "Bayar DP 30% (segera)". */
export function dpPayLabel(mode: DpMode | null, persen: number | null): string {
	if (mode === 'nominal') return 'Bayar DP (segera)';
	const percent = mode === 'persen' && persen !== null ? persen : DP_PERCENT;
	return `Bayar DP ${percent}% (segera)`;
}

/** "10", "10,5", atau "10.50" → perseratus persen (1050 = 10,50%). Di atas 100% ditolak. */
export function parsePercentHundredths(raw: string): { ok: true; value: number } | { ok: false } {
	const text = raw.trim().replace(',', '.');
	if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return { ok: false };
	const [whole, frac = ''] = text.split('.');
	const value = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
	if (!Number.isInteger(value) || value < 0 || value > 10_000) return { ok: false };
	return { ok: true, value };
}

/** 1050 → "10.5", 1000 → "10", 1001 → "10.01". */
export function formatHundredthsInput(hundredths: number): string {
	const n = Math.abs(Math.trunc(hundredths));
	const whole = Math.floor(n / 100);
	const frac = n % 100;
	if (frac === 0) return String(whole);
	if (frac % 10 === 0) return `${whole}.${frac / 10}`;
	return `${whole}.${String(frac).padStart(2, '0')}`;
}

/** Persen bulat 0–100 untuk DP. */
export function parsePercentPoints(raw: string): { ok: true; value: number } | { ok: false } {
	const text = raw.trim();
	if (!/^\d{1,3}$/.test(text)) return { ok: false };
	const value = Number(text);
	if (value > 100) return { ok: false };
	return { ok: true, value };
}

/** Satu butir Include per baris. Kosong → []. */
export function includeLines(raw: string | null | undefined): string[] {
	if (!raw) return [];
	return raw.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** Rapikan catatan Include. `ok: false` bila melewati batas. */
export function normalizeIncludeText(raw: string): { ok: true; value: string } | { ok: false } {
	const value = raw
		.replace(/\r\n/g, '\n')
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
		.join('\n');
	if (value.length > MAX_INCLUDES) return { ok: false };
	return { ok: true, value };
}

/** Judul baris fee. Kosong menjadi DEFAULT_FEE_LABEL. */
export function normalizeFeeLabel(raw: string): { ok: true; value: string } | { ok: false } {
	const value = raw.trim().replace(/\s+/g, ' ');
	if (!value) return { ok: true, value: DEFAULT_FEE_LABEL };
	if (value.length > MAX_FEE_LABEL) return { ok: false };
	return { ok: true, value };
}

/** Rincian baris fee di invoice. */
export function feeDetail(line: Pick<StoredLine, 'feeMode' | 'feeRate'>): string {
	if (line.feeMode === 'persen' && line.feeRate != null) {
		return `${formatHundredthsInput(line.feeRate)}% dari subtotal setelah diskon`;
	}
	return 'Nominal tetap';
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
		if (l.addon) row.kind = 'addon';
		if (l.flat) row.flat = true;
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
			kind: row.kind === 'bebas' ? 'bebas' : row.kind === 'addon' ? 'addon' : row.kind === 'fee' ? 'fee' : 'paket',
			...(row.flat === true ? { flat: true } : {})
		};
		if (typeof row.includes === 'string') {
			const includes = row.includes.replace(/\r\n/g, '\n').trim();
			if (includes) line.includes = includes.slice(0, 4000);
		}
		if (line.kind === 'fee' && (row.feeMode === 'persen' || row.feeMode === 'nominal')) {
			line.feeMode = row.feeMode;
			const rate = Number(row.feeRate);
			if (Number.isInteger(rate) && rate >= 0) line.feeRate = rate;
		}
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
		...(l.kind === 'addon' ? { addon: true } : {}),
		...(l.flat ? { flat: true } : {}),
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

export type ManualQuote = {
	subtotal: number;
	diskon: number;
	fee: number;
	total: number;
	dp: number;
	dpPersen: number;
	/** `null` = DP bawaan DP_PERCENT, bukan kunci admin. */
	dpMode: DpMode | null;
};

export type FeeSpec = {
	mode: 'persen' | 'nominal';
	/** Persen: perseratus persen (1000 = 10,00%). Nominal: rupiah bulat. */
	value: number;
};

export type DpSpec = {
	mode: 'persen' | 'nominal';
	/** Persen: bilangan bulat 0–100. Nominal: rupiah bulat. */
	value: number;
};

/**
 * Total invoice manual dari qty × harga satuan, dikurangi diskon, ditambah fee.
 * Fee persen dihitung dari subtotal setelah diskon. DP persen dihitung dari total akhir.
 * `null` bila angkanya tidak sah. Tanpa `extras`, fee 0 dan DP = DP_PERCENT.
 */
export function manualQuote(
	lines: readonly { qty: number; harga: number }[],
	diskon: number,
	extras?: { fee?: FeeSpec | null; dp?: DpSpec | null }
): ManualQuote | null {
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
	const net = subtotal - diskon;
	const fee = feeAmount(net, extras?.fee ?? null);
	if (fee === null) return null;
	const total = net + fee;
	if (!Number.isSafeInteger(total) || total > MAX_RECEIVED) return null;
	const dp = resolveDp(total, extras?.dp ?? null);
	if (!dp) return null;
	return { subtotal, diskon, fee, total, dp: dp.dp, dpPersen: dp.dpPersen, dpMode: dp.dpMode };
}

function feeAmount(net: number, fee: FeeSpec | null): number | null {
	if (!fee) return 0;
	if (fee.mode === 'persen') {
		if (!Number.isInteger(fee.value) || fee.value < 1 || fee.value > 10_000) return null;
		return Math.round((net * fee.value) / 10_000);
	}
	if (!Number.isInteger(fee.value) || fee.value < 1 || fee.value > MAX_RECEIVED) return null;
	return fee.value;
}

function resolveDp(total: number, dp: DpSpec | null): { dp: number; dpPersen: number; dpMode: DpMode | null } | null {
	if (!dp || (dp.mode === 'persen' && dp.value === DP_PERCENT)) {
		return { dp: Math.round((total * DP_PERCENT) / 100), dpPersen: DP_PERCENT, dpMode: null };
	}
	if (dp.mode === 'persen') {
		if (!Number.isInteger(dp.value) || dp.value < 0 || dp.value > 100) return null;
		return { dp: Math.round((total * dp.value) / 100), dpPersen: dp.value, dpMode: 'persen' };
	}
	if (!Number.isInteger(dp.value) || dp.value < 0 || dp.value > total || dp.value > MAX_RECEIVED) return null;
	return { dp: dp.value, dpPersen: DP_PERCENT, dpMode: 'nominal' };
}

/** Pesan ke WhatsApp klien, nomor invoice dan tautannya sudah terisi. */
export function buildClientInvoiceMessage(input: {
	nama: string;
	nomor: string;
	total: string;
	dp: string;
	invoiceUrl: string;
	/** Contoh `DP 30%` atau `DP` bila nominal dikunci. Default mengikuti DP_PERCENT. */
	dpHeading?: string;
}): string {
	const dpHeading = input.dpHeading ?? `DP ${DP_PERCENT}%`;
	return [
		`Halo ${input.nama.trim()}, ini invoice dari Lembang Adventure.`,
		'',
		`Nomor invoice: ${input.nomor}`,
		`Total: ${input.total}`,
		`${dpHeading}: ${input.dp}`,
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
		'Halo Lembang Adventure, aku sudah transfer untuk invoice ini.',
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
		'Halo Lembang Adventure, aku barusan hitung di kalkulator website.',
		'',
		`Nama PIC / Perusahaan: ${input.nama.trim()}`,
		`Nomor WhatsApp: +${input.whatsapp}`,
		`Paket: ${input.titles.filter(Boolean).join(', ')}`,
		`Jumlah peserta: ${input.pax} orang`,
		`Tanggal: ${date}`,
		`Estimasi: ${estimasi}`
	];
	if (input.estimate.state === 'complete' || input.estimate.state === 'partial') {
		const each = perPaxAmount(input.estimate.total, input.pax);
		if (each !== null) lines.push(`Per peserta: ${formatRupiah(each)}`);
	}
	for (const line of input.estimate.lines) {
		if (!line.unit || line.subtotal === null) continue;
		lines.push(`${line.title}: ${lineText(line)}`);
	}
	for (const line of input.estimate.lines) {
		if (!line.addon || line.subtotal === null) continue;
		lines.push(`Tambahan: ${line.title} — ${lineText(line)}`);
	}
	const catatan = input.notes.trim();
	if (catatan) lines.push(`Catatan: ${catatan}`);
	lines.push('', `Link invoice: ${input.invoiceUrl}`, '', 'Boleh dicek tanggalnya masih bisa atau tidak, sekalian konfirmasi harga finalnya?');
	return lines.join('\n');
}
