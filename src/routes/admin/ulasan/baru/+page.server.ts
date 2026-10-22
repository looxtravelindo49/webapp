import { fail, redirect } from '@sveltejs/kit';
import { emptyTestimonialRaw, parseTestimonialForm } from '#lib/testimonial-form.js';
import { getDb } from '#lib/server/database.js';
import { createTestimonial } from '#lib/server/testimonials.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	return { values: emptyTestimonialRaw() };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const parsed = parseTestimonialForm(form);
		if (!parsed.ok) return fail(400, { values: parsed.raw, errors: parsed.errors });
		const created = await createTestimonial(await getDb(), parsed.values);
		redirect(303, `/admin/ulasan/${created.id}?simpan=1`);
	}
};
