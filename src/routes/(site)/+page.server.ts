import { safeImage } from '#lib/images.js';
import { listPopularArticles } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { galleryCovers } from '#lib/server/package-photos.js';
import { listPublishedPackages } from '#lib/server/packages.js';
import type { PageServerLoad } from './$types';

const PACKAGE_QUERY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const load: PageServerLoad = async ({ url }) => {
	const db = await getDb();
	const rows = await listPublishedPackages(db);
	const covers = await galleryCovers(db, rows.map((p) => p.id));
	const packages = rows.map((p) => {
		const cover = covers.get(p.id);
		return {
			...p,
			image: safeImage(p.image),
			cover_image: cover ? safeImage(cover.path) : null,
			cover_alt: cover?.alt ?? null
		};
	});
	const requested = url.searchParams.get('paket') ?? '';
	const preselect = PACKAGE_QUERY.test(requested) && packages.some((p) => p.slug === requested) ? requested : null;
	return {
		packages,
		popularArticles: await listPopularArticles(db),
		preselect
	};
};
