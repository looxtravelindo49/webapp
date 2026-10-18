import { listPublishedArticles } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { FEED_CACHE_CONTROL, rssXml } from '#lib/server/seo.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () =>
	new Response(rssXml(undefined, await listPublishedArticles(await getDb())), {
		headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': FEED_CACHE_CONTROL }
	});
