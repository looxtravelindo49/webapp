import { error, fail } from '@sveltejs/kit';
import { formatRupiah } from '#lib/format.js';
import { formatDateTime } from '#lib/format.js';
import { formatPlanDate } from '#lib/estimate.js';
import { DP_PERCENT, isLeadStatus, parseReceivedAmount, parseStoredLines, paymentBadge, statusLabel } from '#lib/invoice.js';
import { getDb } from '#lib/server/database.js';
import { getLeadByNomor, setLeadStatus, updateAdminNote } from '#lib/server/leads.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

const NOTE_LIMIT = 500;

function view(lead: NonNullable<Awaited<ReturnType<typeof getLeadByNomor>>>) {
	return {
		...lead,
		lines: parseStoredLines(lead.paket),
		createdLabel: formatDateTime(lead.created_at),
		statusLabel: statusLabel(lead.status),
		badge: paymentBadge(lead.status, lead.diterima_pada),
		tanggalLabel: lead.tanggal_acara ? formatPlanDate(lead.tanggal_acara) : 'Belum ditentukan',
		estimasiLabel: lead.estimasi_total === null ? 'Dibahas via WhatsApp' : formatRupiah(lead.estimasi_total),
		dpLabel: lead.dp_nominal === null ? null : formatRupiah(lead.dp_nominal),
		dpPercent: lead.dp_persen || DP_PERCENT,
		diterimaLabel: lead.diterima_pada ? formatPlanDate(lead.diterima_pada) : null,
		jumlahLabel: lead.jumlah_diterima === null ? null : formatRupiah(lead.jumlah_diterima),
		jumlahInput: lead.jumlah_diterima === null ? '' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(lead.jumlah_diterima)
	};
}

export const load: PageServerLoad = async ({ locals, params }) => {
	requireUser(locals);
	const lead = await getLeadByNomor(await getDb(), params.nomor);
	if (!lead) error(404, 'Lead tidak ditemukan.');
	return { lead: view(lead) };
};

export const actions: Actions = {
	catatan: async ({ request, locals, params }) => {
		requireUser(locals);
		const raw = String((await request.formData()).get('catatan_admin') ?? '');
		const trimmed = raw.trim();
		if (trimmed.length > NOTE_LIMIT) return fail(400, { error: `Catatan internal maksimal ${NOTE_LIMIT} karakter.`, catatan: raw });
		const ok = await updateAdminNote(await getDb(), params.nomor, trimmed === '' ? null : trimmed);
		if (!ok) return fail(404, { error: 'Lead tidak ditemukan.' });
		return { ok: true as const, kind: 'catatan' as const, notice: 'Catatan internal disimpan.' };
	},

	status: async ({ request, locals, params }) => {
		requireUser(locals);
		const form = await request.formData();
		const status = String(form.get('status') ?? '');
		const diterimaPada = String(form.get('diterima_pada') ?? '');
		const jumlahRaw = String(form.get('jumlah_diterima') ?? '');
		const fields = { statusError: '', diterima_pada: diterimaPada, jumlah_diterima: jumlahRaw };
		if (!isLeadStatus(status) || status === 'baru') return fail(400, { ...fields, statusError: 'Status tidak dikenal.' });
		if (status === 'batal' && form.get('confirm') !== 'yes') {
			return fail(400, { ...fields, statusError: 'Pembatalan perlu konfirmasi.' });
		}
		const amount = parseReceivedAmount(jumlahRaw);
		if (!amount.ok) {
			return fail(400, { ...fields, statusError: 'Jumlah diterima perlu angka bulat, misalnya 1500000 atau 1.500.000.' });
		}
		const result = await setLeadStatus(await getDb(), params.nomor, {
			status,
			diterimaPada,
			jumlah: amount.value
		});
		if (result === 'bad-date') return fail(400, { ...fields, statusError: 'Tanggal diterima belum valid.' });
		if (result === 'missing') return fail(404, { ...fields, statusError: 'Lead tidak ditemukan.' });
		const notice =
			status === 'dp_diterima'
				? 'DP dicatat. Invoice publik sekarang bertanda DP diterima.'
				: status === 'lunas'
					? 'Invoice ditandai lunas.'
					: 'Invoice dibatalkan.';
		return { ok: true as const, kind: 'status' as const, notice };
	}
};
