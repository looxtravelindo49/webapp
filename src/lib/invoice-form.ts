import { DEFAULT_FEE_LABEL, DP_PERCENT, formatHundredthsInput, type StoredLine } from './invoice';

export type InvoiceFormRow = {
	deskripsi: string;
	qty: string;
	harga: string;
	unitName: string;
	capacity: string;
	include: string;
	slug: string;
	kind: string;
	flat: string;
	minPax: string;
};

export type InvoiceFormSeed = {
	token: string;
	nama: string;
	perusahaan: string;
	whatsapp: string;
	tanggal: string;
	jumlahPeserta: string;
	catatan: string;
	diskon: string;
	rows: InvoiceFormRow[];
	feeAktif: boolean;
	feeLabel: string;
	feeMode: 'persen' | 'nominal';
	feeNilai: string;
	dpMode: 'persen' | 'nominal';
	dpNilai: string;
};

const blankRow = (): InvoiceFormRow => ({
	deskripsi: '',
	qty: '1',
	harga: '',
	unitName: '',
	capacity: '',
	include: '',
	slug: '',
	kind: 'bebas',
	flat: '',
	minPax: '1'
});

export const EMPTY_INVOICE_SEED: InvoiceFormSeed = {
	token: 'new',
	nama: '',
	perusahaan: '',
	whatsapp: '',
	tanggal: '',
	jumlahPeserta: '',
	catatan: '',
	diskon: '',
	rows: [blankRow()],
	feeAktif: false,
	feeLabel: DEFAULT_FEE_LABEL,
	feeMode: 'persen',
	feeNilai: '',
	dpMode: 'persen',
	dpNilai: String(DP_PERCENT)
};

export function rowFromStoredLine(line: StoredLine): InvoiceFormRow {
	const perUnit = line.pricingMode === 'per_unit' && line.units && line.unitPrice !== undefined;
	return {
		deskripsi: line.title,
		qty: String(perUnit ? line.units : line.billedPax || 1),
		harga: perUnit ? String(line.unitPrice) : line.price === null ? '' : String(line.price),
		unitName: line.unitName ?? '',
		capacity: line.capacity ? String(line.capacity) : '',
		include: line.includes ?? '',
		slug: line.slug ?? '',
		kind: line.kind === 'addon' || line.kind === 'paket' || line.kind === 'bebas' ? line.kind : 'bebas',
		flat: line.flat ? '1' : '',
		minPax: String(line.minPax || 1)
	};
}

export function seedFromStored(input: {
	nama: string;
	perusahaan: string | null;
	whatsapp: string;
	tanggal: string | null;
	jumlahPeserta: number;
	catatan: string;
	diskon: number | null;
	lines: readonly StoredLine[];
	dpMode: 'persen' | 'nominal' | null;
	dpPersen: number;
	dpNominal: number | null;
}): InvoiceFormSeed {
	const fee = input.lines.find((line) => line.kind === 'fee');
	const items = input.lines.filter((line) => line.kind !== 'fee');
	let feeNilai = '';
	if (fee?.feeMode === 'persen' && fee.feeRate != null) feeNilai = formatHundredthsInput(fee.feeRate);
	else if (fee?.feeMode === 'nominal') feeNilai = String(fee.subtotal ?? fee.feeRate ?? '');
	return {
		token: 'lead',
		nama: input.nama,
		perusahaan: input.perusahaan ?? '',
		whatsapp: input.whatsapp,
		tanggal: input.tanggal ?? '',
		jumlahPeserta: String(input.jumlahPeserta),
		catatan: input.catatan,
		diskon: input.diskon ? String(input.diskon) : '',
		rows: items.length > 0 ? items.map(rowFromStoredLine) : [blankRow()],
		feeAktif: Boolean(fee),
		feeLabel: fee?.title || DEFAULT_FEE_LABEL,
		feeMode: fee?.feeMode === 'nominal' ? 'nominal' : 'persen',
		feeNilai,
		dpMode: input.dpMode === 'nominal' ? 'nominal' : 'persen',
		dpNilai:
			input.dpMode === 'nominal'
				? String(input.dpNominal ?? '')
				: String(input.dpMode === 'persen' ? input.dpPersen : DP_PERCENT)
	};
}

type FailedForm = {
	nama?: string;
	perusahaan?: string;
	whatsapp?: string;
	tanggal?: string;
	jumlahPeserta?: string;
	catatan?: string;
	diskon?: string;
	deskripsi?: string[];
	qty?: string[];
	harga?: string[];
	satuan?: string[];
	kapasitas?: string[];
	include?: string[];
	slug?: string[];
	kind?: string[];
	flat?: string[];
	min_pax?: string[];
	fee_aktif?: string;
	fee_label?: string;
	fee_mode?: string;
	fee_nilai?: string;
	dp_mode?: string;
	dp_nilai?: string;
};

export function invoiceFieldsFromForm(form: FormData) {
	return {
		nama: String(form.get('nama') ?? ''),
		perusahaan: String(form.get('perusahaan') ?? ''),
		whatsapp: String(form.get('whatsapp') ?? ''),
		tanggal: String(form.get('tanggal') ?? ''),
		jumlahPeserta: String(form.get('jumlahPeserta') ?? ''),
		catatan: String(form.get('catatan') ?? ''),
		diskon: String(form.get('diskon') ?? ''),
		deskripsi: form.getAll('deskripsi').map(String),
		qty: form.getAll('qty').map(String),
		harga: form.getAll('harga').map(String),
		satuan: form.getAll('satuan').map(String),
		kapasitas: form.getAll('kapasitas').map(String),
		include: form.getAll('include').map(String),
		slug: form.getAll('slug').map(String),
		kind: form.getAll('kind').map(String),
		flat: form.getAll('flat').map(String),
		min_pax: form.getAll('min_pax').map(String),
		fee_aktif: String(form.get('fee_aktif') ?? ''),
		fee_label: String(form.get('fee_label') ?? ''),
		fee_mode: String(form.get('fee_mode') ?? ''),
		fee_nilai: String(form.get('fee_nilai') ?? ''),
		dp_mode: String(form.get('dp_mode') ?? ''),
		dp_nilai: String(form.get('dp_nilai') ?? '')
	};
}

export function seedFromFailedForm(form: FailedForm): InvoiceFormSeed {
	const deskripsi = form.deskripsi ?? [];
	const count = Math.max(deskripsi.length, form.qty?.length ?? 0, form.harga?.length ?? 0, 1);
	const rows = Array.from({ length: count }, (_, i) => ({
		deskripsi: deskripsi[i] ?? '',
		qty: form.qty?.[i] ?? '1',
		harga: form.harga?.[i] ?? '',
		unitName: form.satuan?.[i] ?? '',
		capacity: form.kapasitas?.[i] ?? '',
		include: form.include?.[i] ?? '',
		slug: form.slug?.[i] ?? '',
		kind: form.kind?.[i] ?? 'bebas',
		flat: form.flat?.[i] ?? '',
		minPax: form.min_pax?.[i] ?? '1'
	}));
	const blank = rows.length === 1 && !rows[0].deskripsi && !rows[0].harga && !rows[0].include;
	return {
		token: 'error',
		nama: form.nama ?? '',
		perusahaan: form.perusahaan ?? '',
		whatsapp: form.whatsapp ?? '',
		tanggal: form.tanggal ?? '',
		jumlahPeserta: form.jumlahPeserta ?? '',
		catatan: form.catatan ?? '',
		diskon: form.diskon ?? '',
		rows: blank ? [blankRow()] : rows,
		feeAktif: form.fee_aktif === '1',
		feeLabel: form.fee_label?.trim() || DEFAULT_FEE_LABEL,
		feeMode: form.fee_mode === 'nominal' ? 'nominal' : 'persen',
		feeNilai: form.fee_nilai ?? '',
		dpMode: form.dp_mode === 'nominal' ? 'nominal' : 'persen',
		dpNilai: form.dp_nilai ?? String(DP_PERCENT)
	};
}
