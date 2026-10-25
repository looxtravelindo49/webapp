import { fail } from '@sveltejs/kit';
import {
	CLIENTS_SETTING_KEY,
	clientsFromStored,
	newClientId,
	normalizeClientName,
	parseClientIntent,
	planClients,
	type ClientLogo
} from '#lib/clients.js';
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

function textFields(form: FormData, key: string): string[] {
	return form.getAll(key).filter((value): value is string => typeof value === 'string');
}

/** Hapus unggahan yang baru ditulis bila simpan gagal, atau yang tidak lagi dipakai. Path `/media/…` diabaikan. */
async function removeUploads(paths: Array<string | null | undefined>) {
	const unique = [...new Set(paths.filter(isUploadPath))];
	if (unique.length === 0) return;
	const store = getStore();
	await Promise.all(unique.map((path) => deleteUpload(store, path).catch((err) => console.error('[uploads] gagal menghapus', path, err))));
}

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	const db = await getDb();
	return {
		whatsapp: (await getSetting(db, 'whatsapp')) ?? '',
		promo: promoFromStored(await getSetting(db, PROMO_SETTING_KEY)),
		clients: clientsFromStored(await getSetting(db, CLIENTS_SETTING_KEY))
	};
};

export const actions: Actions = {
	whatsapp: async ({ request, locals }) => {
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
	},

	clients: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const intent = parseClientIntent(form.get('intent'));
		const rawNew = form.get('new_name');
		const typedNew = normalizeClientName(typeof rawNew === 'string' ? rawNew : '');
		const db = await getDb();
		const current = clientsFromStored(await getSetting(db, CLIENTS_SETTING_KEY));
		const plan = planClients(current, {
			ids: textFields(form, 'id'),
			names: textFields(form, 'name'),
			clearIds: textFields(form, 'clear'),
			intent,
			newName: typedNew
		});
		if (!plan.ok) return fail(400, { clients: true as const, values: plan.clients, newName: plan.newName, message: plan.message });

		const base: ClientLogo[] = plan.clients.map((client) => ({ ...client }));
		const clients = base.map((client) => ({ ...client }));
		const saved: string[] = [];
		const reject = async (message: string) => {
			await removeUploads(saved);
			return fail(400, { clients: true as const, values: base, newName: typedNew, message });
		};

		try {
			for (const id of plan.replaceIds) {
				const photo = await readPhoto(form, `logo_${id}`);
				if (photo.kind === 'error') return reject(photo.message);
				if (photo.kind !== 'new') continue;
				let webp: Uint8Array;
				try {
					webp = await compressToWebp(photo.bytes);
				} catch (err) {
					console.error('[clients] gagal mengompres logo', err);
					return reject(PHOTO_PROCESS);
				}
				const path = await saveImage(getStore(), webp, { ext: 'webp', mime: 'image/webp' });
				saved.push(path);
				const row = clients.find((client) => client.id === id);
				if (row) row.src = path;
			}
			if (plan.addName) {
				const photo = await readPhoto(form, 'new_logo');
				if (photo.kind === 'error') return reject(photo.message);
				let src: string | null = null;
				if (photo.kind === 'new') {
					try {
						const webp = await compressToWebp(photo.bytes);
						src = await saveImage(getStore(), webp, { ext: 'webp', mime: 'image/webp' });
						saved.push(src);
					} catch (err) {
						console.error('[clients] gagal mengompres logo', err);
						return reject(PHOTO_PROCESS);
					}
				}
				clients.push({ id: newClientId(clients.map((client) => client.id)), name: plan.addName, src });
			}
			await setSetting(db, CLIENTS_SETTING_KEY, JSON.stringify(clients));
		} catch (err) {
			await removeUploads(saved);
			throw err;
		}

		const keep = new Set(clients.map((client) => client.src));
		await removeUploads(current.map((client) => client.src).filter((src): src is string => !!src && !keep.has(src)));
		const notice =
			intent.kind === 'add'
				? 'Klien ditambahkan.'
				: intent.kind === 'delete' && clients.length < current.length
					? 'Klien dihapus.'
					: 'Logo klien disimpan.';
		return { ok: true as const, notice };
	}
};
