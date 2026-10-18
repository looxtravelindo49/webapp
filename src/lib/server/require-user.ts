import { redirect } from '@sveltejs/kit';

/** Setiap aksi admin memeriksa ulang sesi di server (lapis kedua selain penjaga di hooks). */
export function requireUser(locals: App.Locals) {
	if (!locals.user) redirect(303, '/admin/login');
	if (locals.user.must_change_password) redirect(303, '/admin/ganti-password');
	return locals.user;
}
