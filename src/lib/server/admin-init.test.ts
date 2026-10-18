import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAdminReset, DEFAULT_ADMIN_LOGIN, DEFAULT_ADMIN_PASSWORD, initAdmin, seedAdmin, warnDefaultPassword } from './admin-init';
import { openDatabase, type Db } from './db';
import { hashPassword, verifyPassword } from './password';
import { createSession, getSessionUser } from './sessions';
import { countUsers, createUser, findUserByLogin, listUsers, setPassword } from './users';

const dbs: Db[] = [];
const fresh = async () => {
	const db = await openDatabase(':memory:');
	dbs.push(db);
	return db;
};
afterEach(() => dbs.splice(0).forEach((d) => d.close()));
const quiet = () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe('seedAdmin', () => {
	it('membuat tepat satu akun bawaan yang wajib ganti password dan bisa login dengan 12345678', async () => {
		const db = await fresh();
		expect(await seedAdmin(db, {}, quiet())).toBe('created');
		expect(await countUsers(db)).toBe(1);
		const u = (await findUserByLogin(db, DEFAULT_ADMIN_LOGIN))!;
		expect(u.login).toBe('admin@looxtravel');
		expect(u.must_change_password).toBe(1);
		expect(await verifyPassword(DEFAULT_ADMIN_PASSWORD, u.password_hash)).toBe(true);
		expect(DEFAULT_ADMIN_PASSWORD).toBe('12345678');
	});

	it('instance lain yang membuat akun awal lebih dulu: dilewati tanpa galat dan tetap satu akun', async () => {
		const db = await fresh();
		// Hitungan awal melihat tabel kosong; instance lain membuat akun sebelum INSERT kita.
		let fired = false;
		const racing = new Proxy(db, {
			get(target, prop, receiver) {
				const value = Reflect.get(target, prop, receiver);
				if (prop !== 'execute') return typeof value === 'function' ? value.bind(target) : value;
				return async (...args: Parameters<Db['execute']>) => {
					const result = await (value as Db['execute']).apply(target, args);
					if (!fired) {
						fired = true; // setelah `SELECT COUNT(*)` pertama selesai
						await createUser(db, { login: DEFAULT_ADMIN_LOGIN, passwordHash: 'dari-instance-lain', mustChangePassword: true });
					}
					return result;
				};
			}
		});
		expect(await seedAdmin(racing, {}, quiet())).toBe('skipped');
		expect(await countUsers(db)).toBe(1);
		expect((await findUserByLogin(db, DEFAULT_ADMIN_LOGIN))!.password_hash).toBe('dari-instance-lain');
	});

	it('memakai ADMIN_SEED_LOGIN dan ADMIN_SEED_PASSWORD bila diset', async () => {
		const db = await fresh();
		await seedAdmin(db, { ADMIN_SEED_LOGIN: 'Pemilik', ADMIN_SEED_PASSWORD: 'rahasia-baru-1' }, quiet());
		expect(await findUserByLogin(db, 'admin@looxtravel')).toBeNull();
		const u = (await findUserByLogin(db, 'pemilik'))!;
		expect(await verifyPassword('rahasia-baru-1', u.password_hash)).toBe(true);
		expect(await verifyPassword('12345678', u.password_hash)).toBe(false);
		expect(u.must_change_password).toBe(1);
	});

	it('tidak membuat atau mengubah apa pun bila sudah ada akun', async () => {
		const db = await fresh();
		await seedAdmin(db, {}, quiet());
		const u = (await findUserByLogin(db, DEFAULT_ADMIN_LOGIN))!;
		await setPassword(db, u.id, await hashPassword('sudah-diganti-1'), false);
		expect(await seedAdmin(db, {}, quiet())).toBe('skipped');
		const after = (await findUserByLogin(db, DEFAULT_ADMIN_LOGIN))!;
		expect(await countUsers(db)).toBe(1);
		expect(after.must_change_password).toBe(0);
		expect(await verifyPassword('sudah-diganti-1', after.password_hash)).toBe(true);
	});

	it('tidak membuat akun bila tabel berisi akun lain', async () => {
		const db = await fresh();
		await createUser(db, { login: 'lain', passwordHash: 'h', mustChangePassword: false });
		expect(await seedAdmin(db, {}, quiet())).toBe('skipped');
		expect((await listUsers(db)).map((u) => u.login)).toEqual(['lain']);
	});

	it.each([
		[{ ADMIN_SEED_PASSWORD: 'pendek' }],
		[{ ADMIN_SEED_LOGIN: 'ada spasi' }],
		[{ ADMIN_SEED_LOGIN: 'sama-123', ADMIN_SEED_PASSWORD: 'sama-123' }]
	])('menolak konfigurasi tidak valid %j (server gagal start)', async (env) => {
		const db = await fresh();
		await expect(seedAdmin(db, env, quiet())).rejects.toThrow(/tidak valid/);
		expect(await countUsers(db)).toBe(0);
	});
});

describe('applyAdminReset', () => {
	const setup = async () => {
		const db = await fresh();
		await seedAdmin(db, { ADMIN_SEED_LOGIN: 'pemilik', ADMIN_SEED_PASSWORD: 'password-lama-1' }, quiet());
		const u = (await findUserByLogin(db, 'pemilik'))!;
		await setPassword(db, u.id, u.password_hash, false);
		return { db, u };
	};

	it('mereset password, mewajibkan ganti, dan mencabut sesi; mencetak peringatan keras', async () => {
		const { db, u } = await setup();
		const s = await createSession(db, u.id);
		const log = quiet();
		const r = await applyAdminReset(db, { ADMIN_RESET_LOGIN: 'Pemilik', ADMIN_RESET_PASSWORD: 'pulih-sementara-1' }, log);
		expect(r).toBe('reset');
		const after = (await findUserByLogin(db, 'pemilik'))!;
		expect(await verifyPassword('pulih-sementara-1', after.password_hash)).toBe(true);
		expect(await verifyPassword('password-lama-1', after.password_hash)).toBe(false);
		expect(after.must_change_password).toBe(1);
		expect(await getSessionUser(db, s.token)).toBeNull();
		expect(String(log.warn.mock.calls[0][0])).toMatch(/SEGERA hapus ADMIN_RESET_LOGIN/);
	});

	it('akun tidak ada: galat di log, tidak ada yang berubah', async () => {
		const { db, u } = await setup();
		const log = quiet();
		const r = await applyAdminReset(db, { ADMIN_RESET_LOGIN: 'hantu', ADMIN_RESET_PASSWORD: 'pulih-sementara-1' }, log);
		expect(r).toBe('not-found');
		expect(log.error).toHaveBeenCalledOnce();
		expect((await findUserByLogin(db, 'pemilik'))!.password_hash).toBe(u.password_hash);
	});

	it('password reset tidak memenuhi aturan: ditolak dan tidak ada yang berubah', async () => {
		const { db, u } = await setup();
		const log = quiet();
		const r = await applyAdminReset(db, { ADMIN_RESET_LOGIN: 'pemilik', ADMIN_RESET_PASSWORD: 'pendek' }, log);
		expect(r).toBe('invalid-password');
		expect(log.error).toHaveBeenCalledOnce();
		expect((await findUserByLogin(db, 'pemilik'))!.password_hash).toBe(u.password_hash);
	});

	it('hanya salah satu variabel: diabaikan dengan peringatan', async () => {
		const { db, u } = await setup();
		for (const env of [{ ADMIN_RESET_LOGIN: 'pemilik' }, { ADMIN_RESET_PASSWORD: 'pulih-sementara-1' }]) {
			const log = quiet();
			expect(await applyAdminReset(db, env, log)).toBe('skipped');
			expect(log.warn).toHaveBeenCalledOnce();
		}
		expect((await findUserByLogin(db, 'pemilik'))!.password_hash).toBe(u.password_hash);
	});

	it('tanpa variabel: tidak melakukan apa pun dan tidak mencetak log', async () => {
		const { db } = await setup();
		const log = quiet();
		expect(await applyAdminReset(db, {}, log)).toBe('skipped');
		expect(log.warn).not.toHaveBeenCalled();
		expect(log.error).not.toHaveBeenCalled();
	});
});

describe('warnDefaultPassword / initAdmin', () => {
	it('memperingatkan akun wajib-ganti yang masih memakai password bawaan', async () => {
		const db = await fresh();
		await seedAdmin(db, {}, quiet());
		const log = quiet();
		expect(await warnDefaultPassword(db, log)).toBe(1);
		expect(String(log.warn.mock.calls[0][0])).toMatch(/password bawaan/);
	});

	it('tidak memperingatkan bila password awal sudah ditimpa lewat environment', async () => {
		const db = await fresh();
		await seedAdmin(db, { ADMIN_SEED_PASSWORD: 'rahasia-baru-1' }, quiet());
		expect(await warnDefaultPassword(db, quiet())).toBe(0);
	});

	it('tidak memperingatkan setelah password diganti', async () => {
		const db = await fresh();
		await seedAdmin(db, {}, quiet());
		const u = (await findUserByLogin(db, DEFAULT_ADMIN_LOGIN))!;
		await setPassword(db, u.id, await hashPassword('sudah-diganti-1'), false);
		expect(await warnDefaultPassword(db, quiet())).toBe(0);
	});

	it('initAdmin idempoten: dijalankan dua kali tetap satu akun', async () => {
		const db = await fresh();
		await initAdmin(db, {}, quiet());
		await initAdmin(db, {}, quiet());
		expect(await countUsers(db)).toBe(1);
	});
});
