import { getDb } from '#lib/server/database.js';
import { countLeads, listLeads } from '#lib/server/leads.js';
import { requireUser } from '#lib/server/require-user.js';
import type { PageServerLoad } from './$types';

const LIMIT = 200;

export const load: PageServerLoad = async ({ locals }) => {
	requireUser(locals);
	const db = await getDb();
	const [leads, total] = await Promise.all([listLeads(db, LIMIT), countLeads(db)]);
	return { leads, total, limit: LIMIT };
};
