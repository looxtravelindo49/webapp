import { error, fail, redirect } from '@sveltejs/kit';
import { invoiceFieldsFromForm, seedFromStored } from '#lib/invoice-form.js';
import { INVOICE_NUMBER, parseStoredLines } from '#lib/invoice.js';
import { validitySnapshot } from '#lib/invoice-validity.js';
import { getDb } from '#lib/server/database.js';
import { getLeadByNomor, updateIssuedInvoice, updateLeadValidity } from '#lib/server/leads.js';
import { listAllPackages } from '#lib/server/packages.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requireUser(locals);
	const db = await getDb();
	const lead = await getLeadByNomor(db, params.nomor);
	if (!lead) error(404, 'Lead tidak ditemukan.');
	const packages = await listAllPackages(db);
	const dari = url.searchParams.get('dari') ?? '';
	return {
		nomor: lead.nomor_invoice,
		duplicatedFrom: INVOICE_NUMBER.test(dari) ? dari : null,
		validity: validitySnapshot(lead.berlaku_hingga),
		seed: seedFromStored({
			nama: lead.nama,
			perusahaan: lead.perusahaan,
			whatsapp: lead.whatsapp,
			tanggal: lead.tanggal_acara,
			jumlahPeserta: lead.jumlah_peserta,
			catatan: lead.catatan,
			diskon: lead.diskon,
			lines: parseStoredLines(lead.paket),
			dpMode: lead.dp_mode,
			dpPersen: lead.dp_persen,
			dpNominal: lead.dp_nominal
		}),
		packages: packages.map((p) => ({
			slug: p.slug,
			title: p.title,
			price: p.price_per_person,
			pricing_mode: p.pricing_mode ?? 'per_person',
			kapasitas_per_unit: p.kapasitas_per_unit ?? null,
			nama_unit: p.nama_unit ?? null
		}))
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		requireUser(locals);
		const raw = invoiceFieldsFromForm(await request.formData());
		const result = await updateIssuedInvoice(await getDb(), params.nomor, raw);
		if (!result.ok) return fail(result.status, { message: result.message, ...raw });
		redirect(303, `/admin/leads/${params.nomor}?ubah=1`);
	},

	berlaku: async ({ request, locals, params }) => {
		requireUser(locals);
		const form = await request.formData();
		const result = await updateLeadValidity(await getDb(), params.nomor, {
			action: String(form.get('masa_aksi') ?? ''),
			mode: String(form.get('masa_mode') ?? ''),
			nilai: String(form.get('masa_nilai') ?? '')
		});
		if (!result.ok) return fail(result.status, { validityError: result.message });
		return { ok: true as const, validityNotice: result.notice };
	}
};
