import { safeImage } from '#lib/images.js';
import { listPopularArticles } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { listPublishedPackages } from '#lib/server/packages.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = await getDb();
	return {
		packages: (await listPublishedPackages(db)).map((p) => ({ ...p, image: safeImage(p.image) })),
		popularArticles: await listPopularArticles(db)
	};
};
