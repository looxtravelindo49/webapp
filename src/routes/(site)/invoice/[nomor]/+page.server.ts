import { error } from '@sveltejs/kit';
import { formatRupiah } from '#lib/format.js';
import { formatDateTime } from '#lib/format.js';
import { formatPlanDate, totalNote, totalText } from '#lib/estimate.js';
import { buildPaymentProofMessage, DP_PERCENT, estimateFromStored, paymentBadge } from '#lib/invoice.js';
import { getDb } from '#lib/server/database.js';
import { getLeadByNomor, leadLines, leadMessage } from '#lib/server/leads.js';
import { getSetting } from '#lib/server/settings.js';
import { normalizeWhatsapp, waLink } from '#lib/whatsapp.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	setHeaders({
		'cache-control': 'private, no-store',
		'x-robots-tag': 'noindex, nofollow'
	});

	const db = await getDb();
	const lead = await getLeadByNomor(db, params.nomor);
	if (!lead) error(404, 'Invoice ini tidak ada.');

	const lines = leadLines(lead);
	const estimate = estimateFromStored(lines, lead.estimasi_total);
	const destination = normalizeWhatsapp(await getSetting(db, 'whatsapp'));

	const fresh = lead.status === 'baru';
	return {
		nomor: lead.nomor_invoice,
		createdLabel: formatDateTime(lead.created_at),
		status: lead.status,
		badge: paymentBadge(lead.status, lead.diterima_pada),
		nama: lead.nama,
		whatsapp: `+${lead.whatsapp}`,
		lines: lines.map((l) => ({
			title: l.title,
			detail:
				l.price === null
					? 'Harga menyusul'
					: `${l.billedPax.toLocaleString('id-ID')} × ${formatRupiah(l.price)}${
							l.billedPax > lead.jumlah_peserta ? ` · ditagihkan minimal ${l.minPax} peserta` : ''
						}`,
			amount: l.subtotal === null ? 'Harga menyusul' : formatRupiah(l.subtotal)
		})),
		pax: lead.jumlah_peserta,
		tanggalLabel: lead.tanggal_acara ? formatPlanDate(lead.tanggal_acara) : 'Belum ditentukan',
		catatan: lead.catatan,
		estimasiLabel: totalText(estimate),
		estimasiNote: totalNote(estimate),
		dpPercent: DP_PERCENT,
		dpLabel: lead.dp_nominal === null ? null : formatRupiah(lead.dp_nominal),
		waUrl: destination ? waLink(destination, leadMessage(lead)) : null,
		proofUrl: fresh && destination ? waLink(destination, buildPaymentProofMessage(lead.nomor_invoice)) : null
	};
};
