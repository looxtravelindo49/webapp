import { error } from '@sveltejs/kit';
import { safeImage } from '#lib/images.js';
import { getDb } from '#lib/server/database.js';
import { getPublishedPackageBySlug } from '#lib/server/packages.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const pkg = await getPublishedPackageBySlug(await getDb(), params.slug);
	if (!pkg) error(404, 'Paket ini tidak ada.');
	return { pkg: { ...pkg, image: safeImage(pkg.image) } };
};
