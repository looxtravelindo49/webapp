import { fail } from '@sveltejs/kit';
import { formatGoogleSummary, GOOGLE_RATING_SETTING, GOOGLE_REVIEW_COUNT_SETTING, parseGoogleSummary } from '#lib/content/reviews.js';
import { getDb } from '#lib/server/database.js';
import { deleteTestimonial, listTestimonials, moveTestimonial } from '#lib/server/testimonials.js';
import { requireUser } from '#lib/server/require-user.js';
import { getSetting, setSetting } from '#lib/server/settings.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	const db = await getDb();
	return {
		items: await listTestimonials(db),
		googleRating: (await getSetting(db, GOOGLE_RATING_SETTING)) ?? '',
		googleReviewCount: (await getSetting(db, GOOGLE_REVIEW_COUNT_SETTING)) ?? ''
	};
};

const NOT_FOUND = 'Ulasan tidak ditemukan.';
const targetId = (form: FormData) => Number(form.get('id'));

export const actions: Actions = {
	ringkasan: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const googleRating = String(form.get('google_rating') ?? '');
		const googleReviewCount = String(form.get('google_review_count') ?? '');
		const parsed = parseGoogleSummary(googleRating, googleReviewCount);
		if (!parsed.ok) return fail(400, { summaryError: parsed.error, googleRating, googleReviewCount });
		const db = await getDb();
		await setSetting(db, GOOGLE_RATING_SETTING, parsed.rating);
		await setSetting(db, GOOGLE_REVIEW_COUNT_SETTING, String(parsed.count));
		return { ok: true as const, notice: `Ringkasan disimpan: ${formatGoogleSummary(parsed.rating, parsed.count)}.` };
	},
	naik: async ({ request, locals }) => {
		requireUser(locals);
		return move(targetId(await request.formData()), 'up');
	},
	turun: async ({ request, locals }) => {
		requireUser(locals);
		return move(targetId(await request.formData()), 'down');
	},
	hapus: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = targetId(form);
		if (form.get('confirm') !== 'yes') return fail(400, { id, error: 'Penghapusan perlu konfirmasi. Muat ulang halaman, lalu coba lagi.' });
		const ok = await deleteTestimonial(await getDb(), id);
		if (!ok) return fail(404, { id, error: NOT_FOUND });
		return { ok: true as const, notice: 'Ulasan dihapus.' };
	}
};

async function move(id: number, direction: 'up' | 'down') {
	const result = await moveTestimonial(await getDb(), id, direction);
	if (result === 'notfound') return fail(404, { id, error: NOT_FOUND });
	return { ok: true as const, notice: result === 'moved' ? 'Urutan ulasan diperbarui.' : 'Urutan tidak berubah.' };
}
