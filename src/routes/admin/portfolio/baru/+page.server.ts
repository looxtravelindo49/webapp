import { fail, redirect } from '@sveltejs/kit';
import { emptyPortfolioRaw, parsePortfolioForm } from '#lib/portfolio-form.js';
import { getDb } from '#lib/server/database.js';
import { createPortfolioItem } from '#lib/server/portfolio-save.js';
import { requireUser } from '#lib/server/require-user.js';
import { readPhotoReady } from '#lib/server/uploads.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	return { values: emptyPortfolioRaw() };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const photo = await readPhotoReady(form);
		const willHaveImage = photo.kind === 'new';
		const parsed = parsePortfolioForm(form, willHaveImage);
		if (!parsed.ok || photo.kind === 'error') {
			return fail(400, { values: parsed.raw, errors: parsed.ok ? {} : parsed.errors, photoError: photo.kind === 'error' ? photo.message : '' });
		}
		const created = await createPortfolioItem(await getDb(), parsed.values, photo.kind === 'new' ? photo : { kind: 'none' });
		if ('error' in created) return fail(400, { values: parsed.raw, errors: {}, photoError: created.error });
		redirect(303, `/admin/portfolio/${created.id}?simpan=1`);
	}
};
