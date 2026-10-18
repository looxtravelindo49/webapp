import { redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { deleteSession, SESSION_COOKIE } from '#lib/server/sessions.js';
import type { RequestHandler } from './$types';

// Keluar hanya lewat POST (tidak bisa dipicu oleh tautan/gambar dari situs lain).
export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (locals.sessionToken) await deleteSession(await getDb(), locals.sessionToken);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	redirect(303, '/admin/login');
};
