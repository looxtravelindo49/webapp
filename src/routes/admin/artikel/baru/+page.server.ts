import { fail, redirect } from '@sveltejs/kit';
import { emptyRaw, parseArticleForm, readUnsplashId } from '#lib/article-form.js';
import { CoverError, createArticleWithCover } from '#lib/server/article-save.js';
import { getDb } from '#lib/server/database.js';
import { readPhoto } from '#lib/server/package-save.js';
import { requireUser } from '#lib/server/require-user.js';
import { getUnsplash } from '#lib/server/unsplash.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	return { values: emptyRaw(), unsplashEnabled: getUnsplash().enabled };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const parsed = parseArticleForm(form);
		const photo = await readPhoto(form);
		const pick = readUnsplashId(form);
		const photoError = photo.kind === 'error' ? photo.message : pick.kind === 'error' ? pick.message : '';
		// Semua masukan (termasuk berkas) divalidasi sebelum apa pun ditulis ke penyimpanan.
		if (!parsed.ok || photoError) return fail(400, { values: parsed.raw, errors: parsed.ok ? {} : parsed.errors, photoError });
		// Artikel baru selalu draf dan tidak populer (form baru tidak menyediakan kotak centangnya).
		const values = { ...parsed.values, published: false, featured: false };
		let created;
		try {
			created = await createArticleWithCover(await getDb(), values, photo, undefined, pick.kind === 'id' ? pick.id : null);
		} catch (err) {
			if (err instanceof CoverError) return fail(400, { values: parsed.raw, errors: {}, photoError: err.message });
			throw err;
		}
		redirect(303, `/admin/artikel/${created.id}?dibuat=1`);
	}
};
