import { getDb } from '#lib/server/database.js';
import { listPublishedArticles } from '#lib/server/articles.js';
import { latestPackageUpdate, listSitemapPackages } from '#lib/server/packages.js';
import { FEED_CACHE_CONTROL, sitemapEntries, sitemapXml } from '#lib/server/seo.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const db = await getDb();
	const [articles, packagesUpdatedAt, packages] = await Promise.all([
		listPublishedArticles(db),
		latestPackageUpdate(db),
		listSitemapPackages(db)
	]);
	return new Response(sitemapXml(undefined, sitemapEntries(articles, packagesUpdatedAt, packages)), {
		headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': FEED_CACHE_CONTROL }
	});
};
