import { afterEach, describe, expect, it, vi } from 'vitest';
import { initOrExit, warnIfLocalSiteUrl } from './startup';

afterEach(() => vi.restoreAllMocks());

describe('initOrExit', () => {
	it('tidak keluar bila inisialisasi berhasil', async () => {
		const exit = vi.fn() as unknown as (code: number) => never;
		await initOrExit(() => {}, exit);
		expect(exit).not.toHaveBeenCalled();
	});

	it('mencatat galat dan keluar dengan kode 1 bila inisialisasi gagal', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const exit = vi.fn() as unknown as (code: number) => never;
		await initOrExit(() => {
			throw new Error('disk penuh');
		}, exit);
		expect(exit).toHaveBeenCalledWith(1);
		expect(error).toHaveBeenCalledOnce();
		expect(String(error.mock.calls[0][1])).toContain('disk penuh');
	});

	it('menangani penolakan promise (init asinkron)', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const exit = vi.fn() as unknown as (code: number) => never;
		await initOrExit(async () => {
			throw new Error('async gagal');
		}, exit);
		expect(exit).toHaveBeenCalledWith(1);
		expect(String(error.mock.calls[0][1])).toContain('async gagal');
	});
});

describe('warnIfLocalSiteUrl', () => {
	const run = (env: Record<string, string | undefined>) => {
		const warn = vi.fn();
		return { warned: warnIfLocalSiteUrl(env, warn), warn };
	};
	it('peringatan bila produksi dan PUBLIC_SITE_URL tidak diatur', () => {
		const { warned, warn } = run({ NODE_ENV: 'production' });
		expect(warned).toBe(true);
		expect(warn.mock.calls[0][0]).toContain('belum diatur');
	});
	it.each(['http://localhost:3000', 'http://127.0.0.1:4180', 'bukan url'])('peringatan bila produksi dan %s', (url) => {
		expect(run({ NODE_ENV: 'production', PUBLIC_SITE_URL: url }).warned).toBe(true);
	});
	it('tanpa peringatan bila alamat produksi benar', () => {
		const { warned, warn } = run({ NODE_ENV: 'production', PUBLIC_SITE_URL: 'https://lembangadventure.id' });
		expect(warned).toBe(false);
		expect(warn).not.toHaveBeenCalled();
	});
	it('tanpa peringatan di luar produksi', () => {
		expect(run({ NODE_ENV: 'development' }).warned).toBe(false);
		expect(run({}).warned).toBe(false);
	});
});
