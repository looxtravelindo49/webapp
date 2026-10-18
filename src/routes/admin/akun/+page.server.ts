import { fail } from '@sveltejs/kit';
import { getDb } from '#lib/server/database.js';
import { requireUser } from '#lib/server/require-user.js';
import { hashPassword, validateNewPassword } from '#lib/server/password.js';
import { createUser, deleteUser, findUserById, listUsers, normalizeLogin, resetPassword, validateLogin } from '#lib/server/users.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => ({
	currentId: locals.user?.id ?? null,
	users: listUsers(getDb()).map((u) => ({
		id: u.id,
		login: u.login,
		mustChange: u.must_change_password === 1,
		createdAt: u.created_at
	}))
});

const targetId = (form: FormData) => Number(form.get('id'));

export const actions: Actions = {
	buat: async ({ request, locals }) => {
		requireUser(locals);
		const form = await request.formData();
		const rawLogin = String(form.get('login') ?? '');
		const password = String(form.get('password') ?? '');
		const login = normalizeLogin(rawLogin);

		const errors: { login?: string; password?: string } = {};
		const badLogin = validateLogin(login);
		if (badLogin) errors.login = badLogin;
		const badPassword = validateNewPassword(password, { login });
		if (badPassword) errors.password = badPassword;
		if (errors.login || errors.password) return fail(400, { action: 'buat' as const, login: rawLogin, errors });

		const result = createUser(getDb(), { login, passwordHash: await hashPassword(password), mustChangePassword: true });
		if (!result.ok) {
			const taken: { login?: string; password?: string } = { login: result.message };
			return fail(400, { action: 'buat' as const, login: rawLogin, errors: taken });
		}
		return {
			action: 'buat' as const,
			ok: true as const,
			notice: `Akun "${result.user.login}" dibuat. Berikan password sementara itu kepada pemiliknya; ia wajib menggantinya saat login pertama.`
		};
	},

	reset: async ({ request, locals }) => {
		const actor = requireUser(locals);
		const form = await request.formData();
		const id = targetId(form);
		const password = String(form.get('password') ?? '');
		const db = getDb();
		const target = findUserById(db, id);
		if (!target) return fail(404, { action: 'reset' as const, id, error: 'Akun tidak ditemukan.' });
		if (target.id === actor.id) {
			return fail(400, {
				action: 'reset' as const,
				id,
				error: 'Untuk mengganti password sendiri, gunakan halaman Ganti password.'
			});
		}
		const bad = validateNewPassword(password, { login: target.login });
		if (bad) return fail(400, { action: 'reset' as const, id, error: bad });

		const result = resetPassword(db, actor.id, target.id, await hashPassword(password));
		if (!result.ok) return fail(400, { action: 'reset' as const, id, error: result.message });
		return {
			action: 'reset' as const,
			ok: true as const,
			notice: `Password "${target.login}" diatur ulang. Sesinya dicabut dan ia wajib menggantinya saat login berikutnya.`
		};
	},

	hapus: async ({ request, locals }) => {
		const actor = requireUser(locals);
		const form = await request.formData();
		const id = targetId(form);
		// Konfirmasi ditegakkan di server: tanda ini hanya diisi saat pengguna menyetujui dialog.
		// Tanpa JS, atau saat tombol diklik sebelum halaman selesai dimuat, penghapusan ditolak.
		if (form.get('confirm') !== 'yes') {
			return fail(400, {
				action: 'hapus' as const,
				id,
				error: 'Penghapusan perlu konfirmasi. Muat ulang halaman, lalu coba lagi.'
			});
		}
		const db = getDb();
		const target = findUserById(db, id);
		const result = deleteUser(db, actor.id, id);
		if (!result.ok) return fail(result.error === 'notfound' ? 404 : 400, { action: 'hapus' as const, id, error: result.message });
		return { action: 'hapus' as const, ok: true as const, notice: `Akun "${target?.login}" dihapus.` };
	}
};
