import { optionalImage } from '#lib/images.js';
import { getDb } from '#lib/server/database.js';
import { listPortfolio } from '#lib/server/portfolio.js';
import { loadPublicReviews } from '#lib/server/public-reviews.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = await getDb();
	const items = (await listPortfolio(db)).flatMap((item) => {
		const image = optionalImage(item.image);
		return image ? [{ id: item.id, image, alt: item.alt, caption: item.caption }] : [];
	});
	return { items, reviews: await loadPublicReviews(db) };
};
