import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { ADMIN_HEADERS, guardAdmin, isAdminPath } from '#lib/server/admin-guard.js';
import { initAdmin } from '#lib/server/admin-init.js';
import { getDb } from '#lib/server/database.js';
import { getSessionUser, SESSION_COOKIE } from '#lib/server/sessions.js';
import { initOrExit } from '#lib/server/startup.js';

// Migrasi, seed, dan inisialisasi akun admin berjalan sekali saat server start, bukan pada
// request pertama. Jika gagal, proses berhenti dengan exit code 1.
export const init: ServerInit = () => initOrExit(async () => initAdmin(await getDb()));

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.sessionToken = null;
	const { pathname } = event.url;

	// Situs publik tidak menyentuh database untuk sesi.
	if (!isAdminPath(pathname)) return resolve(event);

	const token = event.cookies.get(SESSION_COOKIE) ?? null;
	if (token) {
		const user = await getSessionUser(await getDb(), token);
		if (user) {
			event.locals.user = { id: user.id, login: user.login, must_change_password: user.must_change_password };
			event.locals.sessionToken = token;
		} else {
			event.cookies.delete(SESSION_COOKIE, { path: '/' }); // token basi/kedaluwarsa
		}
	}

	const redirectTo = guardAdmin(pathname, event.locals.user);
	const response = redirectTo
		? new Response(null, { status: 303, headers: { location: redirectTo } })
		: await resolve(event);

	for (const [k, v] of Object.entries(ADMIN_HEADERS)) response.headers.set(k, v);
	return response;
};
