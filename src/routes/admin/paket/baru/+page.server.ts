import { fail, redirect } from '@sveltejs/kit';
import { emptyRaw, parsePackageForm } from '#lib/package-form.js';
import { getDb } from '#lib/server/database.js';
import { createWithPhoto, readPhoto } from '#lib/server/package-save.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	return { values: emptyRaw() };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const parsed = parsePackageForm(form);
		const photo = await readPhoto(form);
		// Semua masukan (termasuk berkas) divalidasi sebelum apa pun ditulis ke disk.
		if (!parsed.ok || photo.kind === 'error') {
			return fail(400, {
				values: parsed.raw,
				errors: parsed.ok ? {} : parsed.errors,
				photoError: photo.kind === 'error' ? photo.message : ''
			});
		}
		const created = createWithPhoto(getDb(), parsed.values, photo);
		redirect(303, `/admin/paket/${created.id}?dibuat=1`);
	}
};
