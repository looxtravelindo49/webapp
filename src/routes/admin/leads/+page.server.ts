import { isLeadStatus } from '#lib/invoice.js';
import { getDb } from '#lib/server/database.js';
import { countLeads, listLeads } from '#lib/server/leads.js';
import { requireUser } from '#lib/server/require-user.js';
import type { PageServerLoad } from './$types';

const LIMIT = 200;

export const load: PageServerLoad = async ({ locals, url }) => {
	requireUser(locals);
	const raw = url.searchParams.get('status') ?? '';
	const status = isLeadStatus(raw) ? raw : null;
	const db = await getDb();
	const [leads, total, totalAll] = await Promise.all([
		listLeads(db, LIMIT, status),
		countLeads(db, status),
		countLeads(db)
	]);
	return { leads, total, totalAll, limit: LIMIT, status };
};
