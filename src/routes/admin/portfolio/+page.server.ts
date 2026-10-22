import { fail } from '@sveltejs/kit';
import { parsePortfolioBatch, parsePortfolioText } from '#lib/portfolio-form.js';
import { getDb } from '#lib/server/database.js';
import { deletePortfolio, listPortfolio, movePortfolio, updatePortfolioText } from '#lib/server/portfolio.js';
import { readPortfolioPhotos, storePortfolioPhotos } from '#lib/server/portfolio-save.js';
import { requireUser } from '#lib/server/require-user.js';
import { deleteUpload, getStore } from '#lib/server/uploads.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return { items: await listPortfolio(await getDb()) };
};

const NOT_FOUND = 'Foto tidak ditemukan.';
const targetId = (form: FormData) => Number(form.get('id'));
const strings = (form: FormData, name: string) => form.getAll(name).map((value) => String(value));

export const actions: Actions = {
	unggah: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const photos = await readPortfolioPhotos(form);
		if (!photos.ok) return fail(400, { error: photos.error });
		const parsed = parsePortfolioBatch(strings(form, 'alt'), strings(form, 'caption'), photos.photos.length);
		if (!parsed.ok) return fail(400, { error: parsed.error });
		const stored = await storePortfolioPhotos(await getDb(), photos.photos, parsed.items);
		if (!stored.ok) return fail(400, { error: stored.error });
		return { ok: true as const, notice: stored.count === 1 ? '1 foto ditambahkan.' : `${stored.count} foto ditambahkan.` };
	},
	teks: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = targetId(form);
		const parsed = parsePortfolioText(String(form.get('alt') ?? ''), String(form.get('caption') ?? ''));
		if (!parsed.ok) return fail(400, { id, error: parsed.error });
		const ok = await updatePortfolioText(await getDb(), id, parsed.alt, parsed.caption);
		if (!ok) return fail(404, { id, error: NOT_FOUND });
		return { ok: true as const, notice: 'Teks foto disimpan.' };
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
		const result = await deletePortfolio(await getDb(), id);
		if (!result.ok) return fail(404, { id, error: NOT_FOUND });
		await deleteUpload(getStore(), result.image).catch((err) => console.error('[uploads] gagal menghapus', result.image, err));
		return { ok: true as const, notice: 'Foto dihapus.' };
	}
};

async function move(id: number, direction: 'up' | 'down') {
	const result = await movePortfolio(await getDb(), id, direction);
	if (result === 'notfound') return fail(404, { id, error: NOT_FOUND });
	return { ok: true as const, notice: result === 'moved' ? 'Urutan foto diperbarui.' : 'Urutan tidak berubah.' };
}
