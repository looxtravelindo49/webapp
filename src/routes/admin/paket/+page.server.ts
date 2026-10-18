import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { deletePackage, getPackage, listAllPackages, movePackage, setPublished } from '#lib/server/packages.js';
import { requireUser } from '#lib/server/require-user.js';
import { deleteUpload, getStore, isUploadPath } from '#lib/server/uploads.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return {
		packages: (await listAllPackages(await getDb())).map((p) => ({
			id: p.id,
			title: p.title,
			slug: p.slug,
			published: p.published === 1,
			price: p.price_per_person,
			minPax: p.min_pax
		}))
	};
};

const NOT_FOUND = 'Paket tidak ditemukan.';
const targetId = (form: FormData) => Number(form.get('id'));

export const actions: Actions = {
	naik: async ({ request, locals }) => {
		requireUser(locals);
		const id = targetId(await request.formData());
		return move(id, 'up');
	},

	turun: async ({ request, locals }) => {
		requireUser(locals);
		const id = targetId(await request.formData());
		return move(id, 'down');
	},

	terbit: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = targetId(form);
		const db = await getDb();
		const pkg = await getPackage(db, id);
		if (!pkg) return fail(404, { action: 'terbit' as const, id, error: NOT_FOUND });
		const publish = pkg.published !== 1;
		await setPublished(db, id, publish);
		return {
			action: 'terbit' as const,
			ok: true as const,
			notice: publish ? `Paket "${pkg.title}" diterbitkan dan kini tampil di situs.` : `Paket "${pkg.title}" disembunyikan dari situs.`
		};
	},

	hapus: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const id = targetId(form);
		// Konfirmasi ditegakkan di server: tanda ini hanya diisi saat pengguna menyetujui dialog.
		// Tanpa JS, atau saat tombol diklik sebelum halaman selesai dimuat, penghapusan ditolak.
		if (form.get('confirm') !== 'yes') {
			return fail(400, { action: 'hapus' as const, id, error: 'Penghapusan perlu konfirmasi. Muat ulang halaman, lalu coba lagi.' });
		}
		const db = await getDb();
		const pkg = await getPackage(db, id);
		const result = await deletePackage(db, id);
		if (!result.ok) return fail(404, { action: 'hapus' as const, id, error: NOT_FOUND });
		// Foto bawaan (/media/…) tidak pernah dihapus; kegagalan menghapus berkas tidak membatalkan penghapusan paket.
		if (isUploadPath(result.image)) await deleteUpload(getStore(), result.image).catch((err) => console.error('[uploads] gagal menghapus', result.image, err));
		return { action: 'hapus' as const, ok: true as const, notice: `Paket "${pkg?.title}" dihapus.` };
	}
};

async function move(id: number, direction: 'up' | 'down') {
	const result = await movePackage(await getDb(), id, direction);
	if (result === 'notfound') return fail(404, { action: 'urutan' as const, id, error: NOT_FOUND });
	// Di batas tidak ada yang berubah dan itu bukan kesalahan.
	return { action: 'urutan' as const, ok: true as const, notice: result === 'moved' ? 'Urutan paket diperbarui.' : 'Urutan tidak berubah.' };
}
