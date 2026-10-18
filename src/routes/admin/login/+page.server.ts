import { fail, redirect } from '@sveltejs/kit';
import { ADMIN_CHANGE_PASSWORD } from '#lib/server/admin-guard.js';
import { getDb } from '#lib/server/database.js';
import { verifyDummy, verifyPassword } from '#lib/server/password.js';
import { loginLimiter } from '#lib/server/rate-limit.js';
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '#lib/server/sessions.js';
import { findUserByLogin, normalizeLogin, recordLogin } from '#lib/server/users.js';
import type { Actions } from './$types';

const GENERIC_ERROR = 'Login atau password salah.';
const LOCKED_ERROR = 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
// Batas wajar agar masukan raksasa tidak membebani hashing.
const MAX_INPUT = 1000;

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress, setHeaders }) => {
		const form = await request.formData();
		const rawLogin = String(form.get('login') ?? '');
		const password = String(form.get('password') ?? '');
		const login = normalizeLogin(rawLogin).slice(0, MAX_INPUT);

		let ip = 'unknown';
		try {
			ip = getClientAddress();
		} catch {
			// tanpa alamat klien (mis. di balik proxy tanpa ADDRESS_HEADER): semua klien berbagi satu kunci
		}
		const key = `${login}|${ip}`;
		const now = Date.now();

		const check = loginLimiter.check(key, now);
		if (!check.allowed) {
			setHeaders({ 'Retry-After': String(check.retryAfterSeconds) });
			return fail(429, { login: rawLogin, error: LOCKED_ERROR });
		}

		const db = getDb();
		const user = rawLogin.length > MAX_INPUT || password.length > MAX_INPUT ? null : findUserByLogin(db, login);
		// Akun tidak ada → tetap menghitung hash agar waktu respons tidak membocorkan keberadaan akun.
		const ok = user ? await verifyPassword(password, user.password_hash) : await verifyDummy(password);
		if (!user || !ok) {
			loginLimiter.fail(key, now);
			return fail(400, { login: rawLogin, error: GENERIC_ERROR });
		}

		loginLimiter.succeed(key);
		const { token } = createSession(db, user.id);
		recordLogin(db, user.id);
		cookies.set(SESSION_COOKIE, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: url.protocol === 'https:',
			maxAge: SESSION_MAX_AGE_SECONDS
		});
		redirect(303, user.must_change_password ? ADMIN_CHANGE_PASSWORD : '/admin');
	}
};
