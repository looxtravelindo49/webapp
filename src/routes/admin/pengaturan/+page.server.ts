import { fail } from '@sveltejs/kit';
import { parsePromoForm, PROMO_SETTING_KEY, promoFromStored, type PromoErrors } from '#lib/promo.js';
import { readPhoto } from '#lib/server/package-save.js';
import { getDb } from '#lib/server/database.js';
import { compressToWebp } from '#lib/server/image-compress.js';
import { requireUser } from '#lib/server/require-user.js';
import { getSetting, setSetting } from '#lib/server/settings.js';
import { deleteUpload, getStore, isUploadPath, saveImage } from '#lib/server/uploads.js';
import { normalizeWhatsapp } from '#lib/whatsapp.js';
import type { Actions, PageServerLoad } from './$types';

const WHATSAPP_MESSAGE = 'Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890 atau +62 812 3456 7890.';
const PHOTO_PROCESS = 'Foto tidak bisa diproses. Pilih JPEG, PNG, atau WebP lain.';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	const db = await getDb();
	return {
		whatsapp: (await getSetting(db, 'whatsapp')) ?? '',
		promo: promoFromStored(await getSetting(db, PROMO_SETTING_KEY))
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const raw = String(form.get('whatsapp') ?? '');
		const trimmed = raw.trim();

		// Kosong diizinkan: aksi WhatsApp di kalkulator disembunyikan.
		if (trimmed === '') {
			await setSetting(await getDb(), 'whatsapp', '');
			return { ok: true as const, notice: 'Nomor WhatsApp dikosongkan. Tombol "Booking via WhatsApp" disembunyikan dari kalkulator.' };
		}
		const normalized = normalizeWhatsapp(trimmed);
		if (!normalized) return fail(400, { whatsapp: raw, error: WHATSAPP_MESSAGE });
		await setSetting(await getDb(), 'whatsapp', normalized);
		return { ok: true as const, notice: `Nomor WhatsApp disimpan: ${normalized}.` };
	},

	promo: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const parsed = parsePromoForm(form);
		const photo = await readPhoto(form, 'photo');
		const errors: PromoErrors = { ...parsed.errors };
		if (photo.kind === 'error') errors.image = photo.message;
		if (Object.keys(errors).length > 0) return fail(400, { promo: true as const, values: parsed.promo, errors });

		const db = await getDb();
		const previous = promoFromStored(await getSetting(db, PROMO_SETTING_KEY)).image;
		let image = parsed.promo.image;
		let added: string | null = null;
		if (photo.kind === 'new') {
			try {
				const webp = await compressToWebp(photo.bytes);
				added = await saveImage(getStore(), webp, { ext: 'webp', mime: 'image/webp' });
				image = added;
			} catch (err) {
				console.error('[promo] gagal mengompres foto', err);
				const errors: PromoErrors = { image: PHOTO_PROCESS };
				return fail(400, { promo: true as const, values: parsed.promo, errors });
			}
		}
		try {
			await setSetting(db, PROMO_SETTING_KEY, JSON.stringify({ ...parsed.promo, image }));
		} catch (err) {
			if (added) await deleteUpload(getStore(), added).catch((cleanup) => console.error('[uploads] gagal menghapus', added, cleanup));
			throw err;
		}
		if (added && previous !== added && isUploadPath(previous)) {
			await deleteUpload(getStore(), previous).catch((err) => console.error('[uploads] gagal menghapus', previous, err));
		}
		return {
			ok: true as const,
			notice: 'Promo disimpan. Popup memakai pengaturan ini. Mengubah isi membuatnya tampil lagi bagi pengunjung yang sudah menutupnya.'
		};
	}
};
