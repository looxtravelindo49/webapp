import { getDb } from '#lib/server/database.js';
import { getPublishedPackageBySlug } from '#lib/server/packages.js';
import { getSetting } from '#lib/server/settings.js';
import { siteUrl } from '#lib/server/site.js';
import { normalizeWhatsapp } from '#lib/whatsapp.js';
import type { LayoutServerLoad } from './$types';

// Dibaca pada setiap request supaya perubahan dari database langsung tampil.
export const load: LayoutServerLoad = async ({ url }) => {
	const db = await getDb();
	const match = url.pathname.match(/^\/paket\/([^/]+)\/?$/);
	const pkg = match ? await getPublishedPackageBySlug(db, decodeURIComponent(match[1])) : null;
	return {
		waNumber: normalizeWhatsapp(await getSetting(db, 'whatsapp')),
		siteUrl: siteUrl(),
		chatPackage: pkg?.title ?? null
	};
};
