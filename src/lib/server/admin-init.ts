import { all, transaction, type Db } from './db';
import { hashPassword, validateNewPassword, verifyPassword } from './password';
import { deleteUserSessions } from './sessions';
import { countUsers, createUser, findUserByLogin, normalizeLogin, setPassword, validateLogin } from './users';

export const DEFAULT_ADMIN_LOGIN = 'admin@looxtravel';
export const DEFAULT_ADMIN_PASSWORD = '12345678';

export type Env = Record<string, string | undefined>;
export type Logger = Pick<Console, 'log' | 'warn' | 'error'>;

/**
 * Buat akun admin awal hanya bila tabel `user` kosong. Login/password dari
 * `ADMIN_SEED_LOGIN`/`ADMIN_SEED_PASSWORD`, bawaan `admin@looxtravel`/`12345678`.
 * Akun wajib ganti password pada login pertama.
 */
export async function seedAdmin(db: Db, env: Env, log: Logger = console): Promise<'created' | 'skipped'> {
	if ((await countUsers(db)) > 0) return 'skipped';
	const login = normalizeLogin(env.ADMIN_SEED_LOGIN || DEFAULT_ADMIN_LOGIN);
	const password = env.ADMIN_SEED_PASSWORD || DEFAULT_ADMIN_PASSWORD;
	const bad = validateLogin(login) ?? validateNewPassword(password, { login });
	if (bad) throw new Error(`ADMIN_SEED_LOGIN/ADMIN_SEED_PASSWORD tidak valid: ${bad}`);
	const result = await createUser(db, {
		login,
		passwordHash: await hashPassword(password),
		mustChangePassword: true
	});
	// Instance lain yang start bersamaan sudah membuatnya lebih dulu: bukan galat.
	if (!result.ok && result.error === 'taken') return 'skipped';
	if (!result.ok) throw new Error(`Gagal membuat akun admin awal: ${result.message}`);
	log.log(`[auth] akun admin awal dibuat: ${login} (wajib ganti password saat login pertama)`);
	return 'created';
}

/**
 * Pemulihan lewat environment: bila `ADMIN_RESET_LOGIN` dan `ADMIN_RESET_PASSWORD` keduanya diset,
 * atur ulang password akun itu, wajibkan ganti password, dan cabut semua sesinya. Kegagalan hanya
 * dicatat di log (server tetap berjalan).
 */
export async function applyAdminReset(
	db: Db,
	env: Env,
	log: Logger = console
): Promise<'reset' | 'skipped' | 'not-found' | 'invalid-password'> {
	const rawLogin = env.ADMIN_RESET_LOGIN;
	const password = env.ADMIN_RESET_PASSWORD;
	if (!rawLogin && !password) return 'skipped';
	if (!rawLogin || !password) {
		log.warn('[auth] ADMIN_RESET_LOGIN dan ADMIN_RESET_PASSWORD harus diisi keduanya; diabaikan.');
		return 'skipped';
	}
	const user = await findUserByLogin(db, rawLogin);
	if (!user) {
		log.error(`[auth] ADMIN_RESET_LOGIN="${normalizeLogin(rawLogin)}" tidak ditemukan; tidak ada yang diubah.`);
		return 'not-found';
	}
	const bad = validateNewPassword(password, { login: user.login });
	if (bad) {
		log.error(`[auth] ADMIN_RESET_PASSWORD ditolak: ${bad} Tidak ada yang diubah.`);
		return 'invalid-password';
	}
	const hash = await hashPassword(password);
	await transaction(db, async (tx) => {
		await setPassword(tx, user.id, hash, true);
		await deleteUserSessions(tx, user.id);
	});
	log.warn(
		`[auth] password akun "${user.login}" diatur ulang lewat ADMIN_RESET_*; akun wajib ganti password. ` +
			'SEGERA hapus ADMIN_RESET_LOGIN dan ADMIN_RESET_PASSWORD dari environment (jika dibiarkan, password diatur ulang di setiap start).'
	);
	return 'reset';
}

/** Peringatan di log bila masih ada akun wajib-ganti yang memakai password bawaan. */
export async function warnDefaultPassword(db: Db, log: Logger = console): Promise<number> {
	const rows = await all<{ login: string; password_hash: string }>(
		db,
		'SELECT login, password_hash FROM user WHERE must_change_password = 1'
	);
	let n = 0;
	for (const r of rows) {
		if (await verifyPassword(DEFAULT_ADMIN_PASSWORD, r.password_hash)) {
			n++;
			log.warn(`[auth] PERINGATAN: akun "${r.login}" masih memakai password bawaan. Login dan ganti password sebelum situs dibuka ke publik.`);
		}
	}
	return n;
}

/** Urutan inisialisasi admin saat server start. */
export async function initAdmin(db: Db, env: Env = process.env, log: Logger = console): Promise<void> {
	await seedAdmin(db, env, log);
	await applyAdminReset(db, env, log);
	await warnDefaultPassword(db, log);
}
