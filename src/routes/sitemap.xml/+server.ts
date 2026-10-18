import { sitemapXml } from '#lib/server/seo.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(sitemapXml(), { headers: { 'content-type': 'application/xml; charset=utf-8' } });
