import { error, fail } from '@sveltejs/kit';
import { parsePackageForm, rawFromPackage } from '#lib/package-form.js';
import { getDb } from '#lib/server/database.js';
import { editWithPhoto, readPhoto } from '#lib/server/package-save.js';
import {
	attachGalleryPhoto,
	GALLERY_FULL_MESSAGE,
	listPackagePhotos,
	movePackagePhoto,
	normalizeGalleryAlt,
	removePackagePhoto,
	setPackagePhotoAlt
} from '#lib/server/package-photos.js';
import { getPackage } from '#lib/server/packages.js';
import { requireUser } from '#lib/server/require-user.js';
import { deleteUpload, getStore, isUploadPath } from '#lib/server/uploads.js';
import type { Actions, PageServerLoad } from './$types';

const parseId = (raw: string) => (/^\d{1,9}$/.test(raw) ? Number(raw) : NaN);
const PHOTO_REQUIRED = 'Pilih foto galeri terlebih dahulu.';
const PHOTO_MISSING = 'Foto galeri tidak ditemukan.';

const photoIdOf = (form: FormData) => {
	const raw = form.get('photo_id');
	return typeof raw === 'string' && /^\d{1,9}$/.test(raw) ? Number(raw) : NaN;
};

export const load: PageServerLoad = async ({ params, locals, url }) => {
	requireUser(locals);
	const db = await getDb();
	const pkg = await getPackage(db, parseId(params.id));
	if (!pkg) error(404, 'Paket tidak ditemukan.');
	const photos = await listPackagePhotos(db, pkg.id);
	return {
		id: pkg.id,
		slug: pkg.slug,
		title: pkg.title,
		image: pkg.image,
		photos: photos.map((p) => ({ id: p.id, path: p.path, alt: p.alt })),
		values: rawFromPackage(pkg),
		created: url.searchParams.get('dibuat') === '1'
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		requireUser(locals);
		const id = parseId(params.id);
		const db = await getDb();
		if (!(await getPackage(db, id))) error(404, 'Paket tidak ditemukan.');

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
		if (!(await editWithPhoto(db, id, parsed.values, { photo, removePhoto }))) error(404, 'Paket tidak ditemukan.');
		return { ok: true as const, notice: `Paket "${parsed.values.title}" disimpan.` };
	},

	unggah: async ({ params, request, locals }) => {
		requireUser(locals);
		const id = parseId(params.id);
		const db = await getDb();
		if (!(await getPackage(db, id))) error(404, 'Paket tidak ditemukan.');

		const form = await request.formData();
		const photo = await readPhoto(form, 'gallery_photo');
		if (photo.kind === 'none') return fail(400, { galleryError: PHOTO_REQUIRED });
		if (photo.kind === 'error') return fail(400, { galleryError: photo.message });
		const alt = normalizeGalleryAlt(form.get('gallery_alt'));
		if (!alt.ok) return fail(400, { galleryError: alt.message });

		const saved = await attachGalleryPhoto(db, id, photo, alt.value);
		if (!saved.ok) {
			if (saved.reason === 'full') return fail(400, { galleryError: GALLERY_FULL_MESSAGE });
			error(404, 'Paket tidak ditemukan.');
		}
		return { ok: true as const, notice: 'Foto galeri ditambahkan.' };
	},

	teks: async ({ params, request, locals }) => {
		requireUser(locals);
		const id = parseId(params.id);
		const db = await getDb();
		if (!(await getPackage(db, id))) error(404, 'Paket tidak ditemukan.');
		const form = await request.formData();
		const alt = normalizeGalleryAlt(form.get('gallery_alt'));
		if (!alt.ok) return fail(400, { galleryError: alt.message });
		if (!(await setPackagePhotoAlt(db, id, photoIdOf(form), alt.value))) return fail(404, { galleryError: PHOTO_MISSING });
		return { ok: true as const, notice: 'Teks alternatif galeri disimpan.' };
	},

	naik: async (event) => move(event, 'up'),
	turun: async (event) => move(event, 'down'),

	hapusGaleri: async ({ params, request, locals }) => {
		requireUser(locals);
		const id = parseId(params.id);
		const db = await getDb();
		if (!(await getPackage(db, id))) error(404, 'Paket tidak ditemukan.');
		const form = await request.formData();
		const removed = await removePackagePhoto(db, id, photoIdOf(form));
		if (!removed.ok) return fail(404, { galleryError: PHOTO_MISSING });
		if (isUploadPath(removed.path)) {
			await deleteUpload(getStore(), removed.path).catch((err) => console.error('[uploads] gagal menghapus', removed.path, err));
		}
		return { ok: true as const, notice: 'Foto galeri dihapus.' };
	}
};

async function move({ params, request, locals }: Parameters<Actions['naik']>[0], direction: 'up' | 'down') {
	requireUser(locals);
	const id = parseId(params.id);
	const db = await getDb();
	if (!(await getPackage(db, id))) error(404, 'Paket tidak ditemukan.');
	const form = await request.formData();
	const result = await movePackagePhoto(db, id, photoIdOf(form), direction);
	if (result === 'notfound') return fail(404, { galleryError: PHOTO_MISSING });
	return { ok: true as const, notice: result === 'moved' ? 'Urutan galeri diperbarui.' : 'Foto sudah di posisi itu.' };
}
