import { optionalImage } from '#lib/images.js';
import { getDb } from '#lib/server/database.js';
import { listPortfolio } from '#lib/server/portfolio.js';
import { loadPublicReviews } from '#lib/server/public-reviews.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = await getDb();
	const items = await listPortfolio(db);
	return {
		items: items.map((item) => ({
			id: item.id,
			title: item.title,
			location: item.location,
			eventDate: item.event_date,
			eventType: item.event_type,
			caption: item.caption,
			alt: item.alt ?? '',
			image: optionalImage(item.image)
		})),
		reviews: await loadPublicReviews(db)
	};
};
