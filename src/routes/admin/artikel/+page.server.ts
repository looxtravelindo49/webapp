import { fail } from '@sveltejs/kit';
import { deleteArticle, getArticle, listAllArticles, setFeatured, setPublished } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { requireUser } from '#lib/server/require-user.js';
import { deleteUpload, getStore, isUploadPath } from '#lib/server/uploads.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return {
		articles: (await listAllArticles(await getDb())).map((a) => ({
			id: a.id,
			title: a.title,
			slug: a.slug,
			category: a.category,
			published: a.published === 1,
			featured: a.featured === 1,
			publishedAt: a.published_at
		}))
	};
};

const NOT_FOUND = 'Artikel tidak ditemukan.';
const targetId = (form: FormData) => Number(form.get('id'));

export const actions: Actions = {
	terbit: async ({ request, locals }) => {
		requireUser(locals);
		const id = targetId(await request.formData());
		const db = await getDb();
		const article = await getArticle(db, id);
		if (!article) return fail(404, { action: 'terbit' as const, id, error: NOT_FOUND });
		const publish = article.published !== 1;
		const result = await setPublished(db, id, publish);
		if (result === 'empty') return fail(400, { action: 'terbit' as const, id, error: 'Isi artikel wajib diisi sebelum diterbitkan.' });
		if (result === 'notfound') return fail(404, { action: 'terbit' as const, id, error: NOT_FOUND });
		return {
			action: 'terbit' as const,
			ok: true as const,
			notice: publish ? `Artikel "${article.title}" diterbitkan dan kini tampil di situs.` : `Artikel "${article.title}" disembunyikan dari situs.`
		};
	},

	populer: async ({ request, locals }) => {
		requireUser(locals);
		const id = targetId(await request.formData());
		const db = await getDb();
		const article = await getArticle(db, id);
		if (!article) return fail(404, { action: 'populer' as const, id, error: NOT_FOUND });
		const feature = article.featured !== 1;
		await setFeatured(db, id, feature);
		return {
			action: 'populer' as const,
			ok: true as const,
			notice: feature ? `Artikel "${article.title}" ditandai populer.` : `Tanda populer dilepas dari "${article.title}".`
		};
	},

	hapus: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = targetId(form);
		// Konfirmasi ditegakkan di server: tanda ini hanya diisi saat pengguna menyetujui dialog.
		if (form.get('confirm') !== 'yes') {
			return fail(400, { action: 'hapus' as const, id, error: 'Penghapusan perlu konfirmasi. Muat ulang halaman, lalu coba lagi.' });
		}
		const db = await getDb();
		const article = await getArticle(db, id);
		const result = await deleteArticle(db, id);
		if (!result.ok) return fail(404, { action: 'hapus' as const, id, error: NOT_FOUND });
		// Gambar bawaan (/media/…) tidak pernah dihapus; kegagalan menghapus berkas tidak membatalkan penghapusan artikel.
		if (isUploadPath(result.cover)) await deleteUpload(getStore(), result.cover).catch((err) => console.error('[uploads] gagal menghapus', result.cover, err));
		return { action: 'hapus' as const, ok: true as const, notice: `Artikel "${article?.title}" dihapus.` };
	}
};
