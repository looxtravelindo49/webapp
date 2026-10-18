import { getDb } from '#lib/server/database.js';
import { getSetting } from '#lib/server/settings.js';
import { siteUrl } from '#lib/server/site.js';
import { normalizeWhatsapp } from '#lib/whatsapp.js';
import type { LayoutServerLoad } from './$types';

// Dibaca pada setiap request supaya perubahan dari database langsung tampil.
export const load: LayoutServerLoad = async () => ({
	waNumber: normalizeWhatsapp(await getSetting(await getDb(), 'whatsapp')),
	siteUrl: siteUrl()
});
