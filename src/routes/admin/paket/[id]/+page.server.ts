import { error, fail } from '@sveltejs/kit';
import { parsePackageForm, rawFromPackage } from '#lib/package-form.js';
import { getDb } from '#lib/server/database.js';
import { editWithPhoto, readPhoto } from '#lib/server/package-save.js';
import { getPackage } from '#lib/server/packages.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

const parseId = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : NaN);

export const load: PageServerLoad = ({ params, locals, url }) => {
	requireUser(locals);
	const pkg = getPackage(getDb(), parseId(params.id));
	if (!pkg) error(404, 'Paket tidak ditemukan.');
	return {
		id: pkg.id,
		slug: pkg.slug,
		title: pkg.title,
		image: pkg.image,
		values: rawFromPackage(pkg),
		created: url.searchParams.get('dibuat') === '1'
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		requireUser(locals);
		const id = parseId(params.id);
		const db = getDb();
		if (!getPackage(db, id)) error(404, 'Paket tidak ditemukan.');

		const form = await request.formData();
		const parsed = parsePackageForm(form);
		const photo = await readPhoto(form);
		if (!parsed.ok || photo.kind === 'error') {
			return fail(400, {
				values: parsed.raw,
				errors: parsed.ok ? {} : parsed.errors,
				photoError: photo.kind === 'error' ? photo.message : ''
			});
		}
		const removePhoto = form.get('remove_photo') !== null && form.get('remove_photo') !== '';
		if (!editWithPhoto(db, id, parsed.values, { photo, removePhoto })) error(404, 'Paket tidak ditemukan.');
		return { ok: true as const, notice: `Paket "${parsed.values.title}" disimpan.` };
	}
};
