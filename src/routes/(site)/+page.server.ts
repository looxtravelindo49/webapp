import { safeImage } from '#lib/images.js';
import { listPopularArticles } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { packageGalleries } from '#lib/server/package-photos.js';
import { listPublishedPackages } from '#lib/server/packages.js';
import { loadGoogleSummary, loadPublicReviews } from '#lib/server/public-reviews.js';
import { getSetting } from '#lib/server/settings.js';
import { CLIENTS_SETTING_KEY, clientsFromStored } from '#lib/clients.js';
import { PROMO_SETTING_KEY, promoFromStored } from '#lib/promo.js';
import type { PageServerLoad } from './$types';

const PACKAGE_QUERY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const load: PageServerLoad = async ({ url }) => {
	const db = await getDb();
	// Galeri bergantung pada id paket; query lain lepas satu sama lain dan berjalan paralel.
	const [[rows, galleries], popularArticles, reviews, googleSummary, promoSetting, clientsSetting] = await Promise.all([
		listPublishedPackages(db).then(async (rows) => [rows, await packageGalleries(db, rows.map((p) => p.id))] as const),
		listPopularArticles(db),
		loadPublicReviews(db),
		loadGoogleSummary(db),
		getSetting(db, PROMO_SETTING_KEY),
		getSetting(db, CLIENTS_SETTING_KEY)
	]);
	const packages = rows.map((p) => {
		const photos = galleries.get(p.id) ?? [];
		const cover = photos[0];
		return {
			...p,
			image: safeImage(p.image),
			cover_image: cover ? safeImage(cover.path) : null,
			cover_alt: cover?.alt ?? null,
			gallery: photos.map((photo) => ({ src: safeImage(photo.path), alt: photo.alt }))
		};
	});
	const requested = url.searchParams.get('paket') ?? '';
	const preselect = PACKAGE_QUERY.test(requested) && packages.some((p) => p.slug === requested) ? requested : null;
	return {
		packages,
		popularArticles,
		reviews,
		googleSummary,
		preselect,
		promo: promoFromStored(promoSetting),
		clients: clientsFromStored(clientsSetting)
	};
};
