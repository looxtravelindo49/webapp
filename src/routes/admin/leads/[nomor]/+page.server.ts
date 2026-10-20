import { error, fail } from '@sveltejs/kit';
import { formatRupiah } from '#lib/format.js';
import { formatDateTime } from '#lib/format.js';
import { formatPlanDate } from '#lib/estimate.js';
import { DP_PERCENT, parseStoredLines, statusLabel } from '#lib/invoice.js';
import { getDb } from '#lib/server/database.js';
import { getLeadByNomor, updateAdminNote } from '#lib/server/leads.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireUser(locals);
	const lead = await getLeadByNomor(await getDb(), params.nomor);
	if (!lead) error(404, 'Lead tidak ditemukan.');
	return {
		lead: {
			...lead,
			lines: parseStoredLines(lead.paket),
			createdLabel: formatDateTime(lead.created_at),
			statusLabel: statusLabel(lead.status),
			tanggalLabel: lead.tanggal_acara ? formatPlanDate(lead.tanggal_acara) : 'Belum ditentukan',
			estimasiLabel: lead.estimasi_total === null ? 'Dibahas via WhatsApp' : formatRupiah(lead.estimasi_total),
			dpLabel: lead.dp_nominal === null ? null : formatRupiah(lead.dp_nominal),
			dpPercent: lead.dp_persen || DP_PERCENT
		}
	};
};

export const actions: Actions = {
	catatan: async ({ request, locals, params }) => {
		requireUser(locals);
		const raw = String((await request.formData()).get('catatan_admin') ?? '');
		const trimmed = raw.trim();
		if (trimmed.length > 2000) return fail(400, { error: 'Catatan admin maksimal 2.000 karakter.', catatan: raw });
		const ok = await updateAdminNote(await getDb(), params.nomor, trimmed === '' ? null : trimmed);
		if (!ok) return fail(404, { error: 'Lead tidak ditemukan.' });
		return { ok: true as const, notice: 'Catatan admin disimpan.' };
	}
};
