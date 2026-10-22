import { error, fail, redirect } from '@sveltejs/kit';
import { parseTestimonialForm, type TestimonialRaw } from '#lib/testimonial-form.js';
import { getDb } from '#lib/server/database.js';
import { getTestimonial, updateTestimonial } from '#lib/server/testimonials.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requireUser(locals);
	const item = await getTestimonial(await getDb(), Number(params.id));
	if (!item) error(404, 'Ulasan tidak ditemukan.');
	const values: TestimonialRaw = {
		name: item.reviewer_name,
		rating: String(item.rating),
		body: item.body,
		date: item.review_date,
		url: item.source_url ?? ''
	};
	return { values, saved: url.searchParams.get('simpan') === '1' };
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		requireUser(locals);
		const id = Number(params.id);
		const form = await request.formData();
		const parsed = parseTestimonialForm(form);
		if (!parsed.ok) return fail(400, { values: parsed.raw, errors: parsed.errors });
		const ok = await updateTestimonial(await getDb(), id, parsed.values);
		if (!ok) error(404, 'Ulasan tidak ditemukan.');
		redirect(303, `/admin/ulasan/${id}?simpan=1`);
	}
};
