import { DISCLAIMER, formatPlanDate, sanitizePdfText, totalNote, totalText, type EstimateInput } from './estimate';
import { formatRupiah } from './format';

type JsPdfModule = typeof import('jspdf');
let engine: Promise<JsPdfModule> | null = null;

/** Muat jsPDF sekali (di-cache); aman dipanggil berulang untuk prefetch. */
export function loadPdfEngine(): Promise<JsPdfModule> {
	if (!engine) {
		engine = import('jspdf').catch((err) => {
			engine = null; // izinkan percobaan ulang bila jaringan gagal
			throw err;
		});
	}
	return engine;
}

export type PdfData = EstimateInput & { createdAt: Date };

const GREEN: [number, number, number] = [17, 58, 51];
const GOLD: [number, number, number] = [243, 210, 132];
const TINT: [number, number, number] = [231, 239, 236];
const MUTED: [number, number, number] = [93, 113, 107];
const LINE: [number, number, number] = [220, 228, 224];

const PAGE_W = 210;
const MARGIN = 18;
const RIGHT = PAGE_W - MARGIN;
const PAGE_H = 297;
/** Batas isi tabel/catatan; sisanya disisakan untuk kotak pernyataan di dasar halaman. */
const BOTTOM = 262;
// Kolom tabel (mm): paket di kiri, tiga kolom angka rata kanan.
const COL_PRICE = 118;
const COL_PAX = 148;
const COL_SUB = RIGHT - 3;

const isoDate = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Buat PDF estimasi (A4) di browser. Semua teks disaring ke Latin-1. */
export async function buildEstimatePdf(data: PdfData): Promise<Blob> {
	const { jsPDF } = await loadPdfEngine();
	const doc = new jsPDF({ unit: 'mm', format: 'a4' });
	const s = sanitizePdfText;
	let y = 0;

	const ensure = (h: number) => {
		if (y + h > BOTTOM) {
			doc.addPage();
			y = MARGIN;
		}
	};
	const text = (t: string, x: number, opts?: { align?: 'left' | 'right' | 'center' }) =>
		doc.text(t, x, y, opts);

	// Kop merek
	doc.setFillColor(...GREEN).rect(0, 0, PAGE_W, 34, 'F');
	doc.setFillColor(...GOLD).rect(0, 34, PAGE_W, 1.6, 'F');
	doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(19);
	y = 17;
	text('Lembang Adventures', MARGIN);
	doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GOLD);
	y = 24;
	text('by Loox Travel · WE ORGANIZE MEMORIES.', MARGIN);
	doc.setFont('helvetica', 'bold').setFontSize(9);
	y = 17;
	text('ESTIMASI TRIP', RIGHT, { align: 'right' });

	// Judul dan data umum
	y = 52;
	doc.setTextColor(...GREEN).setFont('helvetica', 'bold').setFontSize(20);
	text('Estimasi Trip', MARGIN);

	const meta: [string, string][] = [
		['Nama tim', data.team.trim()],
		['Dibuat', formatPlanDate(isoDate(data.createdAt))],
		...(formatPlanDate(data.planDate) ? ([['Tanggal rencana', formatPlanDate(data.planDate)]] as [string, string][]) : []),
		['Jumlah peserta', `${data.pax} orang`]
	];
	y += 9;
	doc.setFontSize(10);
	for (const [label, value] of meta) {
		doc.setFont('helvetica', 'normal').setTextColor(...MUTED);
		text(label, MARGIN);
		doc.setFont('helvetica', 'bold').setTextColor(...GREEN);
		const wrapped = doc.splitTextToSize(s(value), RIGHT - MARGIN - 38) as string[];
		doc.text(wrapped, MARGIN + 38, y);
		y += 5.5 * wrapped.length;
	}

	// Tabel paket
	y += 5;
	doc.setFillColor(...TINT).rect(MARGIN, y - 5.5, RIGHT - MARGIN, 9, 'F');
	doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...GREEN);
	text('Paket', MARGIN + 3);
	text('Harga / orang', COL_PRICE, { align: 'right' });
	text('Peserta ditagih', COL_PAX, { align: 'right' });
	text('Subtotal', COL_SUB, { align: 'right' });
	y += 9;

	for (const l of data.estimate.lines) {
		const name = doc.splitTextToSize(s(l.title), COL_PRICE - MARGIN - 38) as string[];
		const note = l.minApplied ? `ditagihkan minimal ${l.minPax} peserta` : '';
		const h = 5 * name.length + (note ? 4 : 0) + 4;
		ensure(h);
		doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...GREEN);
		doc.text(name, MARGIN + 3, y);
		if (note) {
			doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
			doc.text(note, MARGIN + 3, y + 5 * name.length);
		}
		doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GREEN);
		if (l.price === null) {
			doc.setFont('helvetica', 'italic').setTextColor(...MUTED);
			text('Harga menyusul', COL_PRICE, { align: 'right' });
			text('-', COL_PAX, { align: 'right' });
			text('-', COL_SUB, { align: 'right' });
		} else {
			text(formatRupiah(l.price), COL_PRICE, { align: 'right' });
			text(String(l.billedPax), COL_PAX, { align: 'right' });
			doc.setFont('helvetica', 'bold');
			text(formatRupiah(l.subtotal ?? 0), COL_SUB, { align: 'right' });
		}
		y += h - 1;
		doc.setDrawColor(...LINE).line(MARGIN, y, RIGHT, y);
		y += 5;
	}

	// Total
	ensure(22);
	y += 2;
	doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...GREEN);
	text('Total estimasi', MARGIN + 3);
	text(s(totalText(data.estimate)), COL_SUB, { align: 'right' });
	const note = totalNote(data.estimate);
	if (note) {
		y += 5;
		doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
		text(s(note), COL_SUB, { align: 'right' });
	}

	// Catatan
	const notes = data.notes.trim();
	if (notes) {
		y += 12;
		ensure(14);
		doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...GREEN);
		text('Catatan', MARGIN);
		y += 5.5;
		doc.setFont('helvetica', 'normal').setFontSize(9.5);
		for (const row of doc.splitTextToSize(s(notes), RIGHT - MARGIN) as string[]) {
			ensure(5);
			text(row, MARGIN);
			y += 4.8;
		}
	}

	// Pernyataan bukan penawaran, di bagian bawah halaman terakhir
	const disclaimer = doc.splitTextToSize(s(DISCLAIMER), RIGHT - MARGIN - 8) as string[];
	const boxH = 6 + 4.6 * disclaimer.length;
	y = Math.max(y + 10, PAGE_H - MARGIN - boxH);
	if (y + boxH > PAGE_H - MARGIN) {
		doc.addPage();
		y = MARGIN;
	}
	doc.setFillColor(...TINT).rect(MARGIN, y, RIGHT - MARGIN, boxH, 'F');
	doc.setFillColor(...GOLD).rect(MARGIN, y, 1.6, boxH, 'F');
	doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GREEN);
	doc.text(disclaimer, MARGIN + 6, y + 5.5);

	return doc.output('blob');
}
