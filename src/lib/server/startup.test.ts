import { afterEach, describe, expect, it, vi } from 'vitest';
import { initOrExit } from './startup';

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
