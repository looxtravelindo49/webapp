import { error, fail, redirect } from '@sveltejs/kit';
import { invoiceFieldsFromForm, seedFromStored } from '#lib/invoice-form.js';
import { parseStoredLines } from '#lib/invoice.js';
import { getDb } from '#lib/server/database.js';
import { getLeadByNomor, updateIssuedInvoice } from '#lib/server/leads.js';
import { listAllPackages } from '#lib/server/packages.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	requireUser(locals);
	const db = await getDb();
	const lead = await getLeadByNomor(db, params.nomor);
	if (!lead) error(404, 'Lead tidak ditemukan.');
	const packages = await listAllPackages(db);
	return {
		nomor: lead.nomor_invoice,
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
	}
};
