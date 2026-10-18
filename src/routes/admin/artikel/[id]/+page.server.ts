import { error, fail } from '@sveltejs/kit';
import { parseArticleForm, rawFromArticle, readUnsplashId } from '#lib/article-form.js';
import { CoverError, editArticleWithCover } from '#lib/server/article-save.js';
import { getArticle } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { readPhoto } from '#lib/server/package-save.js';
import { requireUser } from '#lib/server/require-user.js';
import { getUnsplash } from '#lib/server/unsplash.js';
import type { Actions, PageServerLoad } from './$types';

const parseId = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : NaN);

export const load: PageServerLoad = async ({ params, locals, url }) => {
	requireUser(locals);
	const article = await getArticle(await getDb(), parseId(params.id));
	if (!article) error(404, 'Artikel tidak ditemukan.');
	return {
		id: article.id,
		slug: article.slug,
		title: article.title,
		published: article.published === 1,
		cover: article.cover_image,
		unsplashEnabled: getUnsplash().enabled,
		unsplashId: article.cover_unsplash_id,
		credit: article.cover_unsplash_id && article.cover_credit_name ? { name: article.cover_credit_name, url: article.cover_credit_url } : null,
		values: rawFromArticle(article),
		created: url.searchParams.get('dibuat') === '1'
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		requireUser(locals);
		const id = parseId(params.id);
		const db = await getDb();
		if (!(await getArticle(db, id))) error(404, 'Artikel tidak ditemukan.');

		const form = await request.formData();
		const parsed = parseArticleForm(form);
		const photo = await readPhoto(form);
		const pick = readUnsplashId(form);
		const photoError = photo.kind === 'error' ? photo.message : pick.kind === 'error' ? pick.message : '';
		if (!parsed.ok || photoError) return fail(400, { values: parsed.raw, errors: parsed.ok ? {} : parsed.errors, photoError });
		const removePhoto = form.get('remove_photo') !== null && form.get('remove_photo') !== '';
		const unsplashId = pick.kind === 'id' ? pick.id : null;
		let saved: boolean;
		try {
			saved = await editArticleWithCover(db, id, parsed.values, { photo, removePhoto, unsplashId });
		} catch (err) {
			if (err instanceof CoverError) return fail(400, { values: parsed.raw, errors: {}, photoError: err.message });
			throw err;
		}
		if (!saved) error(404, 'Artikel tidak ditemukan.');
		return { ok: true as const, notice: `Artikel "${parsed.values.title}" disimpan.` };
	}
};
