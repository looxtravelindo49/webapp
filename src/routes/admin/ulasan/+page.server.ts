import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { deleteTestimonial, listTestimonials, moveTestimonial } from '#lib/server/testimonials.js';
import { requireUser } from '#lib/server/require-user.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return { items: await listTestimonials(await getDb()) };
};

const NOT_FOUND = 'Ulasan tidak ditemukan.';
const targetId = (form: FormData) => Number(form.get('id'));

export const actions: Actions = {
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
