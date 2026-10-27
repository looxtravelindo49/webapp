import { randomBytes } from 'node:crypto';
import {
	buildConfirmationMessage,
	buildInvoiceNumber,
	dpNominal,
	DP_PERCENT,
	estimateFromStored,
	INVOICE_NUMBER,
	isIsoDate,
	isLeadStatus,
	manualQuote,
	normalizeFeeLabel,
	normalizeIncludeText,
	parsePercentHundredths,
	parsePercentPoints,
	parseReceivedAmount,
	parseStoredLines,
	storedLinesFromEstimate,
	todayInJakarta,
	type DpMode,
	type DpSpec,
	type FeeSpec,
	type LeadStatus,
	type StoredLine
} from '#lib/invoice.js';
import { calculateEstimate, parsePax } from '#lib/pricing.js';
import { withAddons } from '#lib/addons.js';
import { normalizeWhatsapp, waLink } from '#lib/whatsapp.js';
import { all, one, run, scalar, transaction, type Db, type Queryable } from './db';
import { listPublishedPackages } from './packages';
import { getSetting } from './settings';

export type Lead = {
	id: number;
	nomor_invoice: string;
	created_at: string;
	nama: string;
	whatsapp: string;
	paket: string;
	jumlah_peserta: number;
	tanggal_acara: string | null;
	catatan: string;
	estimasi_total: number | null;
	dp_persen: number;
	dp_nominal: number | null;
	currency: string;
	status: string;
	invoice_url: string;
	wa_opened: number;
	xendit_invoice_id: string | null;
	xendit_status: string | null;
	paid_at: string | null;
	user_agent: string | null;
	source: string | null;
	catatan_admin: string | null;
	jumlah_diterima: number | null;
	diterima_pada: string | null;
	perusahaan: string | null;
	diskon: number | null;
	dp_mode: DpMode | null;
};

const COLUMNS = `id, nomor_invoice, created_at, nama, whatsapp, paket, jumlah_peserta, tanggal_acara, catatan,
	estimasi_total, dp_persen, dp_nominal, currency, status, invoice_url, wa_opened,
	xendit_invoice_id, xendit_status, paid_at, user_agent, source, catatan_admin,
	jumlah_diterima, diterima_pada, perusahaan, diskon, dp_mode`;

function num(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function mapLead(row: Record<string, unknown>): Lead {
	return {
		id: Number(row.id),
		nomor_invoice: String(row.nomor_invoice),
		created_at: String(row.created_at),
		nama: String(row.nama),
		whatsapp: String(row.whatsapp),
		paket: String(row.paket),
		jumlah_peserta: Number(row.jumlah_peserta),
		tanggal_acara: row.tanggal_acara === null || row.tanggal_acara === undefined ? null : String(row.tanggal_acara),
		catatan: String(row.catatan ?? ''),
		estimasi_total: num(row.estimasi_total),
		dp_persen: Number(row.dp_persen),
		dp_nominal: num(row.dp_nominal),
		currency: String(row.currency),
		status: String(row.status),
		invoice_url: String(row.invoice_url),
		wa_opened: Number(row.wa_opened),
		xendit_invoice_id: row.xendit_invoice_id == null ? null : String(row.xendit_invoice_id),
		xendit_status: row.xendit_status == null ? null : String(row.xendit_status),
		paid_at: row.paid_at == null ? null : String(row.paid_at),
		user_agent: row.user_agent == null ? null : String(row.user_agent),
		source: row.source == null ? null : String(row.source),
		catatan_admin: row.catatan_admin == null ? null : String(row.catatan_admin),
		jumlah_diterima: num(row.jumlah_diterima),
		diterima_pada: row.diterima_pada == null || row.diterima_pada === '' ? null : String(row.diterima_pada),
		perusahaan: row.perusahaan == null || String(row.perusahaan).trim() === '' ? null : String(row.perusahaan),
		diskon: num(row.diskon),
		dp_mode: row.dp_mode === 'persen' || row.dp_mode === 'nominal' ? row.dp_mode : null
	};
}

export function leadLines(lead: Lead): StoredLine[] {
	return parseStoredLines(lead.paket);
}

export function leadMessage(lead: Lead): string {
	const lines = leadLines(lead);
	return buildConfirmationMessage({
		nama: lead.nama,
		whatsapp: lead.whatsapp,
		titles: lines.filter((l) => l.kind !== 'addon' && l.kind !== 'fee').map((l) => l.title),
		pax: lead.jumlah_peserta,
		planDate: lead.tanggal_acara ?? '',
		estimate: estimateFromStored(lines, lead.estimasi_total),
		notes: lead.catatan,
		invoiceUrl: lead.invoice_url
	});
}

export async function getLeadByNomor(db: Queryable, nomor: string): Promise<Lead | null> {
	if (!INVOICE_NUMBER.test(nomor)) return null;
	const row = await one(db, `SELECT ${COLUMNS} FROM lead WHERE nomor_invoice = ?`, [nomor]);
	return row ? mapLead(row) : null;
}

export async function listLeads(db: Queryable, limit = 200, status: LeadStatus | null = null): Promise<Lead[]> {
	const rows = await all<Record<string, unknown>>(
		db,
		status
			? `SELECT ${COLUMNS} FROM lead WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT ?`
			: `SELECT ${COLUMNS} FROM lead ORDER BY created_at DESC, id DESC LIMIT ?`,
		status ? [status, limit] : [limit]
	);
	return rows.map(mapLead);
}

export async function countLeads(db: Queryable, status: LeadStatus | null = null): Promise<number> {
	const value = status
		? await scalar<number>(db, 'SELECT COUNT(*) FROM lead WHERE status = ?', [status])
		: await scalar<number>(db, 'SELECT COUNT(*) FROM lead');
	return Number(value ?? 0);
}

export async function updateAdminNote(db: Queryable, nomor: string, note: string | null): Promise<boolean> {
	if (!INVOICE_NUMBER.test(nomor)) return false;
	const result = await run(db, 'UPDATE lead SET catatan_admin = ? WHERE nomor_invoice = ?', [note, nomor]);
	return result.rowsAffected > 0;
}

export type PaymentInput = {
	status: LeadStatus;
	/** `YYYY-MM-DD`. Kosong pada DP/lunas memakai hari ini (WIB). Diabaikan saat batal. */
	diterimaPada: string;
	/** `null` = kolom tidak diubah. Diabaikan saat batal. */
	jumlah: number | null;
	now?: Date;
};

/**
 * Catat status bayar manual. Batal tidak mengubah tanggal atau nominal yang sudah tercatat.
 */
export async function setLeadStatus(
	db: Queryable,
	nomor: string,
	input: PaymentInput
): Promise<'ok' | 'missing' | 'bad-date'> {
	if (!INVOICE_NUMBER.test(nomor) || !isLeadStatus(input.status) || input.status === 'baru') return 'missing';
	const paying = input.status === 'dp_diterima' || input.status === 'lunas';
	let date: string | null = null;
	if (paying) {
		const raw = input.diterimaPada.trim();
		date = raw === '' ? todayInJakarta(input.now) : isIsoDate(raw) ? raw : null;
		if (!date) return 'bad-date';
	}
	const setAmount = paying && input.jumlah !== null;
	const result = await run(
		db,
		`UPDATE lead
		 SET status = ?,
		     diterima_pada = CASE WHEN ? = 1 THEN ? ELSE diterima_pada END,
		     jumlah_diterima = CASE WHEN ? = 1 THEN ? ELSE jumlah_diterima END
		 WHERE nomor_invoice = ?`,
		[input.status, paying ? 1 : 0, date, setAmount ? 1 : 0, setAmount ? input.jumlah : null, nomor]
	);
	return result.rowsAffected > 0 ? 'ok' : 'missing';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validPlanDate(raw: string): string | null {
	if (!DATE_RE.test(raw)) return null;
	const [y, m, d] = raw.split('-').map(Number);
	const date = new Date(`${raw}T12:00:00`);
	if (Number.isNaN(date.getTime())) return null;
	if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) return null;
	return raw;
}

export type SubmitContext = {
	origin: string;
	userAgent: string | null;
	now?: Date;
	random?: (size: number) => Uint8Array;
};

export type SubmitOk = { ok: true; lead: Lead; waUrl: string };
export type SubmitFail = { ok: false; status: number; message: string };
export type SubmitResult = SubmitOk | SubmitFail;

const FAIL = (status: number, message: string): SubmitFail => ({ ok: false, status, message });

function isUniqueError(err: unknown): boolean {
	const text = err instanceof Error ? `${err.name} ${err.message} ${String((err as { code?: unknown }).code ?? '')}` : String(err);
	return /UNIQUE/i.test(text);
}

/**
 * Simpan lead + invoice. Total dihitung ulang dari harga paket di database.
 * Tidak membuka WhatsApp; pemanggil baru boleh membuka tautan bila `ok`.
 */
export async function submitLead(db: Db, raw: Record<string, unknown>, ctx: SubmitContext): Promise<SubmitResult> {
	const nama = typeof raw.nama === 'string' ? raw.nama.trim() : '';
	if (!nama) return FAIL(400, 'Lengkapi dulu nama PIC / perusahaan.');
	if (nama.length > 100) return FAIL(400, 'Nama PIC / perusahaan terlalu panjang.');

	const whatsapp = normalizeWhatsapp(typeof raw.whatsapp === 'string' ? raw.whatsapp : '');
	if (!whatsapp) return FAIL(400, 'Masukkan nomor WhatsApp kamu yang valid, misalnya 081234567890.');

	const pax = parsePax(typeof raw.jumlahPeserta === 'string' || typeof raw.jumlahPeserta === 'number' ? raw.jumlahPeserta : '');
	if (pax === null) return FAIL(400, 'Jumlah peserta perlu bilangan bulat dari 1 sampai 10.000.');

	let tanggal: string | null = null;
	if (typeof raw.tanggal === 'string' && raw.tanggal.trim() !== '') {
		tanggal = validPlanDate(raw.tanggal.trim());
		if (!tanggal) return FAIL(400, 'Tanggal rencana belum valid.');
	}

	const catatan = typeof raw.catatan === 'string' ? raw.catatan.trim() : '';
	if (catatan.length > 1500) return FAIL(400, 'Catatan terlalu panjang.');

	if (!Array.isArray(raw.paket)) return FAIL(400, 'Pilih minimal satu paket.');
	const slugs = raw.paket.filter((s): s is string => typeof s === 'string' && /^[a-z0-9-]{1,80}$/.test(s)).slice(0, 20);

	const packages = await listPublishedPackages(db);
	const tambahan = Array.isArray(raw.tambahan) ? raw.tambahan : [];
	const estimate = withAddons(calculateEstimate(packages, slugs, pax), tambahan, pax);
	if (estimate.state === 'empty' || estimate.state === 'invalid-pax') {
		return FAIL(400, 'Pilih minimal satu paket yang masih tersedia.');
	}

	const destination = normalizeWhatsapp(await getSetting(db, 'whatsapp'));
	if (!destination) return FAIL(400, 'WhatsApp kami sedang tidak aktif. Estimasi tidak dikirim.');

	const lines = storedLinesFromEstimate(estimate.lines);
	const total = estimate.state === 'quote-only' ? null : estimate.total;
	const dp = dpNominal(total);
	const now = ctx.now ?? new Date();
	const random = ctx.random ?? ((n: number) => randomBytes(n));
	const origin = ctx.origin.replace(/\/$/, '');
	const userAgent = ctx.userAgent?.slice(0, 300) || null;

	let lead: Lead | null = null;
	for (let attempt = 0; attempt < 5 && !lead; attempt++) {
		const nomor = buildInvoiceNumber(now, random(8));
		const invoiceUrl = `${origin}/invoice/${nomor}`;
		try {
			lead = await transaction(db, async (tx) => {
				await run(
					tx,
					`INSERT INTO lead
						(nomor_invoice, nama, whatsapp, paket, jumlah_peserta, tanggal_acara, catatan,
						 estimasi_total, dp_persen, dp_nominal, currency, status, invoice_url, wa_opened, user_agent, source)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IDR', 'baru', ?, 1, ?, 'kalkulator')`,
					[nomor, nama, whatsapp, JSON.stringify(lines), pax, tanggal, catatan, total, DP_PERCENT, dp, invoiceUrl, userAgent]
				);
				const row = await one(tx, `SELECT ${COLUMNS} FROM lead WHERE nomor_invoice = ?`, [nomor]);
				if (!row) throw new Error('lead hilang setelah disimpan');
				return mapLead(row);
			});
		} catch (err) {
			if (isUniqueError(err)) continue;
			throw err;
		}
	}
	if (!lead) return FAIL(500, 'Estimasi belum tersimpan. WhatsApp tidak kami buka. Coba lagi, ya.');

	const waUrl = waLink(destination, leadMessage(lead));
	return { ok: true, lead, waUrl };
}

const MAX_LINES = 30;

type ManualBody = {
	nama: string;
	perusahaan: string | null;
	whatsapp: string;
	pax: number;
	tanggal: string | null;
	catatan: string;
	lines: StoredLine[];
	diskon: number;
	total: number;
	dpPersen: number;
	dp: number;
	dpMode: DpMode | null;
};

function fieldList(raw: unknown): unknown[] {
	return Array.isArray(raw) ? raw : [];
}

function textAt(list: unknown[], index: number): string {
	const value = list[index];
	return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * Baca form invoice manual / edit. Total, fee, dan DP dihitung di sini, bukan dari angka klien.
 * Tanpa field DP, hasilnya DP bawaan. Tanpa fee, tidak ada baris jasa.
 */
function readManualInvoice(raw: Record<string, unknown>): { ok: true; data: ManualBody } | SubmitFail {
	const nama = typeof raw.nama === 'string' ? raw.nama.trim() : '';
	if (!nama) return FAIL(400, 'Isi nama klien.');
	if (nama.length > 100) return FAIL(400, 'Nama klien terlalu panjang.');

	const perusahaanRaw = typeof raw.perusahaan === 'string' ? raw.perusahaan.trim() : '';
	if (perusahaanRaw.length > 120) return FAIL(400, 'Nama perusahaan terlalu panjang.');
	const perusahaan = perusahaanRaw === '' ? null : perusahaanRaw;

	const whatsapp = normalizeWhatsapp(typeof raw.whatsapp === 'string' ? raw.whatsapp : '');
	if (!whatsapp) return FAIL(400, 'Masukkan nomor WhatsApp klien yang valid, misalnya 081234567890.');

	const pax = parsePax(typeof raw.jumlahPeserta === 'string' || typeof raw.jumlahPeserta === 'number' ? raw.jumlahPeserta : '');
	if (pax === null) return FAIL(400, 'Jumlah peserta perlu bilangan bulat dari 1 sampai 10.000.');

	let tanggal: string | null = null;
	if (typeof raw.tanggal === 'string' && raw.tanggal.trim() !== '') {
		tanggal = validPlanDate(raw.tanggal.trim());
		if (!tanggal) return FAIL(400, 'Tanggal acara belum valid.');
	}

	const catatan = typeof raw.catatan === 'string' ? raw.catatan.trim() : '';
	if (catatan.length > 1500) return FAIL(400, 'Catatan terlalu panjang.');

	const deskripsi = fieldList(raw.deskripsi);
	const qty = fieldList(raw.qty);
	const harga = fieldList(raw.harga);
	const satuan = fieldList(raw.satuan);
	const kapasitas = fieldList(raw.kapasitas);
	const include = fieldList(raw.include);
	const slugList = fieldList(raw.slug);
	const kindList = fieldList(raw.kind);
	const flatList = fieldList(raw.flat);
	const minList = fieldList(raw.min_pax);
	const count = Math.max(deskripsi.length, qty.length, harga.length, include.length);
	if (count > MAX_LINES) return FAIL(400, `Maksimal ${MAX_LINES} baris.`);

	const priced: {
		qty: number;
		harga: number;
		title: string;
		unitName: string;
		capacity: number | null;
		includes: string;
		slug: string;
		kind: 'paket' | 'bebas' | 'addon';
		flat: boolean;
		minPax: number;
	}[] = [];
	for (let i = 0; i < count; i++) {
		const title = textAt(deskripsi, i).trim();
		const qtyRaw = textAt(qty, i).trim();
		const hargaRaw = textAt(harga, i);
		const includeRaw = textAt(include, i);
		if (title === '' && qtyRaw === '' && hargaRaw.trim() === '' && includeRaw.trim() === '') continue;
		if (!title || title.length > 200) return FAIL(400, 'Setiap baris perlu deskripsi, paling panjang 200 karakter.');
		if (!/^\d+$/.test(qtyRaw)) return FAIL(400, 'Qty perlu bilangan bulat, minimal 1.');
		const q = Number(qtyRaw);
		const price = parseReceivedAmount(hargaRaw);
		if (!price.ok || price.value === null) return FAIL(400, 'Harga satuan perlu angka bulat, misalnya 249000 atau 249.000.');
		const notes = normalizeIncludeText(includeRaw);
		if (!notes.ok) return FAIL(400, 'Include paling panjang 2000 karakter.');
		const unitName = textAt(satuan, i).trim().replace(/\s+/g, ' ');
		const capRaw = textAt(kapasitas, i).trim();
		const capacity = /^\d+$/.test(capRaw) ? Number(capRaw) : null;
		const kindRaw = textAt(kindList, i);
		const kind = kindRaw === 'paket' || kindRaw === 'addon' || kindRaw === 'bebas' ? kindRaw : 'bebas';
		const slugRaw = textAt(slugList, i).trim();
		const minRaw = textAt(minList, i).trim();
		const minParsed = /^\d+$/.test(minRaw) ? Number(minRaw) : 1;
		priced.push({
			qty: q,
			harga: price.value,
			title,
			unitName: unitName.length > 0 && unitName.length <= 40 ? unitName : '',
			capacity: capacity !== null && capacity >= 1 && capacity <= 10_000 ? capacity : null,
			includes: notes.value,
			slug: /^[a-z0-9-]{1,80}$/.test(slugRaw) ? slugRaw : '',
			kind,
			flat: textAt(flatList, i) === '1',
			minPax: minParsed >= 1 && minParsed <= 10_000 ? minParsed : 1
		});
	}
	if (priced.length === 0) return FAIL(400, 'Tambah minimal satu baris.');

	const diskonParsed = parseReceivedAmount(typeof raw.diskon === 'string' || typeof raw.diskon === 'number' ? String(raw.diskon) : '');
	if (!diskonParsed.ok) return FAIL(400, 'Diskon perlu angka bulat, atau dikosongkan.');
	const diskon = diskonParsed.value ?? 0;

	let fee: FeeSpec | null = null;
	let feeLabel = '';
	if (raw.fee_aktif === '1' || raw.fee_aktif === true) {
		const label = normalizeFeeLabel(typeof raw.fee_label === 'string' ? raw.fee_label : '');
		if (!label.ok) return FAIL(400, 'Judul Fee Services terlalu panjang.');
		feeLabel = label.value;
		if (raw.fee_mode === 'nominal') {
			const amount = parseReceivedAmount(typeof raw.fee_nilai === 'string' || typeof raw.fee_nilai === 'number' ? String(raw.fee_nilai) : '');
			if (!amount.ok || amount.value === null || amount.value < 1) {
				return FAIL(400, 'Nominal Fee Services perlu angka bulat, misalnya 150000.');
			}
			fee = { mode: 'nominal', value: amount.value };
		} else {
			const percent = parsePercentHundredths(typeof raw.fee_nilai === 'string' ? raw.fee_nilai : String(raw.fee_nilai ?? ''));
			if (!percent.ok || percent.value < 1) return FAIL(400, 'Persen Fee Services perlu angka, misalnya 10 atau 10,5.');
			fee = { mode: 'persen', value: percent.value };
		}
	}

	let dp: DpSpec | null = null;
	if (raw.dp_mode === 'nominal') {
		const amount = parseReceivedAmount(typeof raw.dp_nilai === 'string' || typeof raw.dp_nilai === 'number' ? String(raw.dp_nilai) : '');
		if (!amount.ok || amount.value === null) return FAIL(400, 'Nominal DP perlu angka bulat.');
		dp = { mode: 'nominal', value: amount.value };
	} else if (raw.dp_mode === 'persen') {
		const percent = parsePercentPoints(typeof raw.dp_nilai === 'string' || typeof raw.dp_nilai === 'number' ? String(raw.dp_nilai) : '');
		if (!percent.ok) return FAIL(400, 'DP persen perlu bilangan bulat dari 0 sampai 100.');
		dp = { mode: 'persen', value: percent.value };
	}

	const quote = manualQuote(
		priced.map((line) => ({ qty: line.qty, harga: line.harga })),
		diskon,
		{ fee, dp }
	);
	if (!quote) {
		if (dp?.mode === 'nominal') return FAIL(400, 'Nominal DP tidak boleh lebih besar dari total.');
		return FAIL(400, 'Diskon tidak boleh lebih besar dari subtotal, dan qty paling banyak 10.000.');
	}

	const lines: StoredLine[] = priced.map((line) => {
		const row: StoredLine = {
			slug: line.slug,
			title: line.title,
			price: line.harga,
			minPax: line.minPax,
			billedPax: line.qty,
			subtotal: line.qty * line.harga,
			kind: line.kind
		};
		if (line.includes) row.includes = line.includes;
		if (line.flat && line.qty === 1) row.flat = true;
		if (line.unitName && line.capacity) {
			row.pricingMode = 'per_unit';
			row.units = line.qty;
			row.unitPrice = line.harga;
			row.capacity = line.capacity;
			row.unitName = line.unitName;
			row.billedPax = line.qty * line.capacity;
		}
		return row;
	});
	if (fee) {
		lines.push({
			slug: '',
			title: feeLabel,
			price: null,
			minPax: 1,
			billedPax: 1,
			subtotal: quote.fee,
			kind: 'fee',
			flat: true,
			feeMode: fee.mode,
			feeRate: fee.value
		});
	}

	return {
		ok: true,
		data: {
			nama,
			perusahaan,
			whatsapp,
			pax,
			tanggal,
			catatan,
			lines,
			diskon: quote.diskon,
			total: quote.total,
			dpPersen: quote.dpPersen,
			dp: quote.dp,
			dpMode: quote.dpMode
		}
	};
}

/**
 * Invoice yang diisi admin, bukan kalkulator. Total dan DP dihitung ulang di server.
 * Sumber lead: `manual`. Status awal Baru, nomor sama dengan invoice kalkulator.
 */
export async function createManualLead(db: Db, raw: Record<string, unknown>, ctx: SubmitContext): Promise<SubmitResult> {
	const parsed = readManualInvoice(raw);
	if (!parsed.ok) return parsed;
	const data = parsed.data;

	const now = ctx.now ?? new Date();
	const random = ctx.random ?? ((n: number) => randomBytes(n));
	const origin = ctx.origin.replace(/\/$/, '');
	const userAgent = ctx.userAgent?.slice(0, 300) || null;

	let lead: Lead | null = null;
	for (let attempt = 0; attempt < 5 && !lead; attempt++) {
		const nomor = buildInvoiceNumber(now, random(8));
		const invoiceUrl = `${origin}/invoice/${nomor}`;
		try {
			lead = await transaction(db, async (tx) => {
				await run(
					tx,
					`INSERT INTO lead
						(nomor_invoice, nama, whatsapp, perusahaan, paket, jumlah_peserta, tanggal_acara, catatan,
						 estimasi_total, diskon, dp_persen, dp_nominal, dp_mode, currency, status, invoice_url, wa_opened, user_agent, source)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IDR', 'baru', ?, 0, ?, 'manual')`,
					[
						nomor,
						data.nama,
						data.whatsapp,
						data.perusahaan,
						JSON.stringify(data.lines),
						data.pax,
						data.tanggal,
						data.catatan,
						data.total,
						data.diskon,
						data.dpPersen,
						data.dp,
						data.dpMode,
						invoiceUrl,
						userAgent
					]
				);
				const row = await one(tx, `SELECT ${COLUMNS} FROM lead WHERE nomor_invoice = ?`, [nomor]);
				if (!row) throw new Error('lead hilang setelah disimpan');
				return mapLead(row);
			});
		} catch (err) {
			if (isUniqueError(err)) continue;
			throw err;
		}
	}
	if (!lead) return FAIL(500, 'Invoice belum tersimpan. Coba lagi, ya.');
	return { ok: true, lead, waUrl: '' };
}

/**
 * Ubah invoice yang sudah terbit. Nomor, tautan, status bayar, dan nominal diterima tidak berubah.
 */
export async function updateIssuedInvoice(db: Db, nomor: string, raw: Record<string, unknown>): Promise<SubmitResult> {
	if (!INVOICE_NUMBER.test(nomor)) return FAIL(404, 'Invoice tidak ditemukan.');
	const existing = await getLeadByNomor(db, nomor);
	if (!existing) return FAIL(404, 'Invoice tidak ditemukan.');
	const parsed = readManualInvoice(raw);
	if (!parsed.ok) return parsed;
	const data = parsed.data;
	await run(
		db,
		`UPDATE lead SET
			nama = ?, whatsapp = ?, perusahaan = ?, paket = ?, jumlah_peserta = ?, tanggal_acara = ?, catatan = ?,
			estimasi_total = ?, diskon = ?, dp_persen = ?, dp_nominal = ?, dp_mode = ?
		 WHERE nomor_invoice = ?`,
		[
			data.nama,
			data.whatsapp,
			data.perusahaan,
			JSON.stringify(data.lines),
			data.pax,
			data.tanggal,
			data.catatan,
			data.total,
			data.diskon,
			data.dpPersen,
			data.dp,
			data.dpMode,
			nomor
		]
	);
	const lead = await getLeadByNomor(db, nomor);
	if (!lead) return FAIL(500, 'Invoice belum tersimpan. Coba lagi, ya.');
	return { ok: true, lead, waUrl: '' };
}
