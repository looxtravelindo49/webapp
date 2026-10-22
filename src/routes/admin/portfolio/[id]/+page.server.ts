import { error, fail, redirect } from '@sveltejs/kit';
import { parsePortfolioForm, type PortfolioRaw } from '#lib/portfolio-form.js';
import { getDb } from '#lib/server/database.js';
import { getPortfolio } from '#lib/server/portfolio.js';
import { savePortfolioItem } from '#lib/server/portfolio-save.js';
import { requireUser } from '#lib/server/require-user.js';
import { deleteUpload, getStore, readPhotoReady } from '#lib/server/uploads.js';
import type { Actions, PageServerLoad } from './$types';

const rawOf = (item: NonNullable<Awaited<ReturnType<typeof getPortfolio>>>): PortfolioRaw => ({
	title: item.title,
	location: item.location,
	eventDate: item.event_date,
	eventType: item.event_type,
	caption: item.caption,
	alt: item.alt ?? '',
	removePhoto: false
});

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requireUser(locals);
	const item = await getPortfolio(await getDb(), Number(params.id));
	if (!item) error(404, 'Dokumentasi tidak ditemukan.');
	return { item, values: rawOf(item), saved: url.searchParams.get('simpan') === '1' };
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		requireUser(locals);
		const db = await getDb();
		const id = Number(params.id);
		const current = await getPortfolio(db, id);
		if (!current) error(404, 'Dokumentasi tidak ditemukan.');
		const form = await request.formData();
		const photo = await readPhotoReady(form);
		const remove = form.get('remove_photo') === 'yes';
		const willHaveImage = photo.kind === 'new' || (!remove && !!current.image);
		const parsed = parsePortfolioForm(form, willHaveImage);
		if (!parsed.ok || photo.kind === 'error') {
			return fail(400, { values: parsed.raw, errors: parsed.ok ? {} : parsed.errors, photoError: photo.kind === 'error' ? photo.message : '' });
		}
		const saved = await savePortfolioItem(db, id, parsed.values, photo.kind === 'new' ? photo : { kind: 'none' });
		if (!saved.ok) return fail(404, { values: parsed.raw, errors: {}, photoError: saved.error });
		if (saved.dropped) await deleteUpload(getStore(), saved.dropped).catch((err) => console.error('[uploads] gagal menghapus', saved.dropped, err));
		redirect(303, `/admin/portfolio/${id}?simpan=1`);
	}
};
