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
	parseStoredLines,
	storedLinesFromEstimate,
	todayInJakarta,
	type LeadStatus,
	type StoredLine
} from '#lib/invoice.js';
import { calculateEstimate, parsePax } from '#lib/pricing.js';
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
};

const COLUMNS = `id, nomor_invoice, created_at, nama, whatsapp, paket, jumlah_peserta, tanggal_acara, catatan,
	estimasi_total, dp_persen, dp_nominal, currency, status, invoice_url, wa_opened,
	xendit_invoice_id, xendit_status, paid_at, user_agent, source, catatan_admin,
	jumlah_diterima, diterima_pada`;

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
		diterima_pada: row.diterima_pada == null || row.diterima_pada === '' ? null : String(row.diterima_pada)
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
		titles: lines.map((l) => l.title),
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
	if (!nama) return FAIL(400, 'Lengkapi dulu nama tim.');
	if (nama.length > 100) return FAIL(400, 'Nama tim terlalu panjang.');

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
	const estimate = calculateEstimate(packages, slugs, pax);
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
