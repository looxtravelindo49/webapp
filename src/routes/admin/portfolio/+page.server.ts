import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { deletePortfolio, listPortfolio, movePortfolio } from '#lib/server/portfolio.js';
import { requireUser } from '#lib/server/require-user.js';
import { deleteUpload, getStore } from '#lib/server/uploads.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return { items: await listPortfolio(await getDb()) };
};

const NOT_FOUND = 'Dokumentasi tidak ditemukan.';
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
		const result = await deletePortfolio(await getDb(), id);
		if (!result.ok) return fail(404, { id, error: NOT_FOUND });
		if (result.image) await deleteUpload(getStore(), result.image).catch((err) => console.error('[uploads] gagal menghapus', result.image, err));
		return { ok: true as const, notice: 'Dokumentasi dihapus.' };
	}
};

async function move(id: number, direction: 'up' | 'down') {
	const result = await movePortfolio(await getDb(), id, direction);
	if (result === 'notfound') return fail(404, { id, error: NOT_FOUND });
	return { ok: true as const, notice: result === 'moved' ? 'Urutan portfolio diperbarui.' : 'Urutan tidak berubah.' };
}
