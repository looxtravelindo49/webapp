import { listPublishedArticles } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	articles: await listPublishedArticles(await getDb())
});
