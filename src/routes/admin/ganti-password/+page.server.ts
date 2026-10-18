import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { hashPassword, validateNewPassword, verifyPassword } from '#lib/server/password.js';
import { deleteUserSessions } from '#lib/server/sessions.js';
import { findUserById, setPassword } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	mustChange: locals.user?.must_change_password === 1
});

type Errors = { current?: string; next?: string; confirm?: string };

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) redirect(303, '/admin/login');
		const db = getDb();
		const user = findUserById(db, locals.user.id);
		if (!user) redirect(303, '/admin/login');

		const form = await request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		const errors: Errors = {};
		if (!(await verifyPassword(current, user.password_hash))) {
			errors.current = 'Password lama salah.';
		} else {
			const bad = validateNewPassword(next, { login: user.login, current });
			if (bad) errors.next = bad;
			else if (confirm !== next) errors.confirm = 'Konfirmasi password tidak sama.';
		}
		if (errors.current || errors.next || errors.confirm) return fail(400, { errors });

		setPassword(db, user.id, await hashPassword(next), false);
		// Sesi di perangkat lain dibatalkan; sesi saat ini dipertahankan.
		deleteUserSessions(db, user.id, locals.sessionToken ?? undefined);
		redirect(303, '/admin');
	}
};
