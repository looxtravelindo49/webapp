import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { requireUser } from '#lib/server/require-user.js';
import { getSetting, setSetting } from '#lib/server/settings.js';
import { normalizeWhatsapp } from '#lib/whatsapp.js';
import type { Actions, PageServerLoad } from './$types';

const WHATSAPP_MESSAGE = 'Nomor WhatsApp tidak valid. Contoh: 0812-3456-7890 atau +62 812 3456 7890.';

export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	// Tampilkan nilai tersimpan apa adanya (sudah dinormalisasi saat disimpan).
	return { whatsapp: getSetting(getDb(), 'whatsapp') ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const raw = String(form.get('whatsapp') ?? '');
		const trimmed = raw.trim();

		// Kosong diizinkan: aksi WhatsApp di kalkulator disembunyikan.
		if (trimmed === '') {
			setSetting(getDb(), 'whatsapp', '');
			return { ok: true as const, notice: 'Nomor WhatsApp dikosongkan. Tombol "Kirim ke WhatsApp" disembunyikan dari kalkulator.' };
		}
		const normalized = normalizeWhatsapp(trimmed);
		if (!normalized) return fail(400, { whatsapp: raw, error: WHATSAPP_MESSAGE });
		setSetting(getDb(), 'whatsapp', normalized);
		return { ok: true as const, notice: `Nomor WhatsApp disimpan: ${normalized}.` };
	}
};
