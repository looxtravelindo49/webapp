import { requireUser } from '#lib/server/require-user.js';
import { getUnsplash } from '#lib/server/unsplash.js';
import { searchResponse } from '#lib/server/unsplash-api.js';
import type { RequestHandler } from './$types';

/** Proxy pencarian Unsplash untuk pemilih sampul. Hanya admin berlogin; kunci akses tetap di server. */
export const GET: RequestHandler = ({ locals, url }) => {
	requireUser(locals);
	return searchResponse(getUnsplash(), url.searchParams);
};
