import { safeImage } from '#lib/images.js';
import { getDb } from '#lib/server/database.js';
import { listPublishedPackages } from '#lib/server/packages.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	packages: listPublishedPackages(getDb()).map((p) => ({ ...p, image: safeImage(p.image) }))
});
