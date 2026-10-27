import { fail, redirect } from '@sveltejs/kit';
import { invoiceFieldsFromForm } from '#lib/invoice-form.js';
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
			price: p.price_per_person,
			pricing_mode: p.pricing_mode ?? 'per_person',
			kapasitas_per_unit: p.kapasitas_per_unit ?? null,
			nama_unit: p.nama_unit ?? null
		}))
	};
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		requireUser(locals);
		const raw = invoiceFieldsFromForm(await request.formData());
		const result = await createManualLead(await getDb(), raw, {
			origin: url.origin,
			userAgent: request.headers.get('user-agent')
		});
		if (!result.ok) return fail(result.status, { message: result.message, ...raw });
		redirect(303, `/admin/leads/${result.lead.nomor_invoice}?baru=1`);
	}
};
