import { error } from '@sveltejs/kit';
import { formatRupiah } from '#lib/format.js';
import { formatDateTime } from '#lib/format.js';
import { formatPlanDate, perPaxText, totalNote, totalText, unitBreakdown } from '#lib/estimate.js';
import { buildPaymentProofMessage, displayedDp, DP_PERCENT, estimateFromStored, invoiceChrome, settlement, type StoredLine } from '#lib/invoice.js';
import { getDb } from '#lib/server/database.js';
import { getLeadByNomor, leadLines, leadMessage } from '#lib/server/leads.js';
import { getSetting } from '#lib/server/settings.js';
import { normalizeWhatsapp, waLink } from '#lib/whatsapp.js';
import type { PageServerLoad } from './$types';

export const prerender = false;

const lineDetail = (line: StoredLine, pax: number) => {
	if (line.price === null) return 'Harga menyusul';
	if (line.flat) return 'Harga tetap';
	if (line.pricingMode === 'per_unit' && line.units && line.unitPrice !== undefined && line.capacity && line.unitName) {
		return unitBreakdown(line.units, line.unitPrice, line.capacity, line.unitName);
	}
	const base = `${line.billedPax.toLocaleString('id-ID')} × ${formatRupiah(line.price)}`;
	if (line.kind === 'bebas' || line.billedPax <= pax) return base;
	return `${base} · ditagihkan minimal ${line.minPax} peserta`;
};

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({
		'cache-control': 'private, no-store, max-age=0, must-revalidate',
		'cdn-cache-control': 'no-store',
		'vercel-cdn-cache-control': 'no-store',
		pragma: 'no-cache',
		'x-robots-tag': 'noindex, nofollow'
	});

	const db = await getDb();
	const lead = await getLeadByNomor(db, params.nomor);
	if (!lead) error(404, 'Invoice ini tidak ada.');

	const lines = leadLines(lead);
	const estimate = estimateFromStored(lines, lead.estimasi_total);
	const destination = normalizeWhatsapp(await getSetting(db, 'whatsapp'));
	const chrome = invoiceChrome(lead.status);
	const money = settlement(lead.estimasi_total, lead.dp_nominal, lead.jumlah_diterima);
	const dpShown = displayedDp(lead.estimasi_total, lead.dp_nominal, lead.dp_persen);
	const diskon = lead.diskon ?? 0;
	const lineSum = lines.every((l) => l.subtotal !== null) ? lines.reduce((sum, l) => sum + (l.subtotal ?? 0), 0) : null;

	return {
		nomor: lead.nomor_invoice,
		createdLabel: formatDateTime(lead.created_at),
		status: lead.status,
		title: chrome.title,
		badge: chrome.badge,
		stamp: chrome.stamp,
		showPayCta: chrome.showPayCta,
		nama: lead.nama,
		perusahaan: lead.perusahaan,
		whatsapp: `+${lead.whatsapp}`,
		lines: lines.map((l, index) => ({
			key: `${index}-${l.title}`,
			title: l.title,
			detail: lineDetail(l, lead.jumlah_peserta),
			amount: l.subtotal === null ? 'Harga menyusul' : formatRupiah(l.subtotal)
		})),
		pax: lead.jumlah_peserta,
		tanggalLabel: lead.tanggal_acara ? formatPlanDate(lead.tanggal_acara) : 'Belum ditentukan',
		catatan: lead.catatan,
		totalLabel: lead.status === 'baru' ? 'Total estimasi' : 'Total',
		estimasiLabel: totalText(estimate),
		perPaxLabel: perPaxText(lead.estimasi_total, lead.jumlah_peserta),
		estimasiNote: lead.status === 'baru' ? totalNote(estimate) : '',
		subtotalLabel: diskon > 0 && lineSum !== null ? formatRupiah(lineSum) : null,
		diskonLabel: diskon > 0 ? formatRupiah(diskon) : null,
		dpPercent: DP_PERCENT,
		dpLabel: dpShown === null ? null : formatRupiah(dpShown),
		paidLabel: money.paid === null ? null : formatRupiah(money.paid),
		remainingLabel: money.remaining === null ? null : formatRupiah(money.remaining),
		paidDateLabel: lead.diterima_pada ? formatPlanDate(lead.diterima_pada) : null,
		waUrl: destination ? waLink(destination, leadMessage(lead)) : null,
		proofUrl: chrome.showPayCta && destination ? waLink(destination, buildPaymentProofMessage(lead.nomor_invoice)) : null
	};
};
