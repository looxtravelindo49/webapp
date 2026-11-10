import { error } from '@sveltejs/kit';
import { safeImage } from '#lib/images.js';
import { getDb } from '#lib/server/database.js';
import { listPackagePhotos } from '#lib/server/package-photos.js';
import { getPublishedPackageBySlug, listPublishedPackages } from '#lib/server/packages.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const db = await getDb();
	const [pkg, published] = await Promise.all([getPublishedPackageBySlug(db, params.slug), listPublishedPackages(db)]);
	if (!pkg) error(404, 'Paket ini tidak ada.');
	const photos = await listPackagePhotos(db, pkg.id);
	return {
		pkg: { ...pkg, image: safeImage(pkg.image) },
		gallery: photos.map((p) => ({ src: safeImage(p.path), alt: p.alt })),
		// Tautan internal ke paket terbit lain; hanya slug dan judul yang dikirim.
		otherPackages: published.filter((p) => p.id !== pkg.id).map(({ slug, title }) => ({ slug, title }))
	};
};
