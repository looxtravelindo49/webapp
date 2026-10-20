import { safeImage } from '#lib/images.js';
import { listPopularArticles } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { listPublishedPackages } from '#lib/server/packages.js';
import type { PageServerLoad } from './$types';

const PACKAGE_QUERY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const load: PageServerLoad = async ({ url }) => {
	const db = await getDb();
	const packages = (await listPublishedPackages(db)).map((p) => ({ ...p, image: safeImage(p.image) }));
	const requested = url.searchParams.get('paket') ?? '';
	const preselect = PACKAGE_QUERY.test(requested) && packages.some((p) => p.slug === requested) ? requested : null;
	return {
		packages,
		popularArticles: await listPopularArticles(db),
		preselect
	};
};
