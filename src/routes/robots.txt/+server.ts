import { robotsTxt } from '#lib/server/seo.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	new Response(robotsTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
