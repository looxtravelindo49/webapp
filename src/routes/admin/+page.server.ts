import { getDb } from '#lib/server/database.js';
import { countPublishedWithoutPrice } from '#lib/server/packages.js';
import { requireUser } from '#lib/server/require-user.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	return { withoutPrice: await countPublishedWithoutPrice(await getDb()) };
};
