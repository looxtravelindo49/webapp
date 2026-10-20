import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { createManualLead } from '#lib/server/leads.js';
import { listAllPackages } from '#lib/server/packages.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	const packages = await listAllPackages(await getDb());
	return {
		packages: packages.map((p) => ({
			slug: p.slug,
			title: p.title,
			price: p.price_per_person
		}))
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		requireUser(locals);
		const form = await request.formData();
		const raw = {
			nama: String(form.get('nama') ?? ''),
			perusahaan: String(form.get('perusahaan') ?? ''),
			whatsapp: String(form.get('whatsapp') ?? ''),
			tanggal: String(form.get('tanggal') ?? ''),
			jumlahPeserta: String(form.get('jumlahPeserta') ?? ''),
			catatan: String(form.get('catatan') ?? ''),
			diskon: String(form.get('diskon') ?? ''),
			deskripsi: form.getAll('deskripsi').map(String),
			qty: form.getAll('qty').map(String),
			harga: form.getAll('harga').map(String)
		};
		const result = await createManualLead(await getDb(), raw, {
			origin: url.origin,
			userAgent: request.headers.get('user-agent')
		});
		if (!result.ok) return fail(result.status, { message: result.message, ...raw });
		redirect(303, `/admin/leads/${result.lead.nomor_invoice}?baru=1`);
	}
};
