import { describe, expect, it } from 'vitest';
import { LoginLimiter } from './rate-limit';

const MIN = 60_000;

describe('LoginLimiter', () => {
	it('mengizinkan sampai 5 kegagalan lalu mengunci percobaan berikutnya', () => {
		const l = new LoginLimiter();
		for (let i = 0; i < 5; i++) {
			expect(l.check('a|1', 0).allowed).toBe(true);
			l.fail('a|1', i * 1000);
		}
		const r = l.check('a|1', 6000);
		expect(r.allowed).toBe(false);
		if (!r.allowed) expect(r.retryAfterSeconds).toBe(Math.ceil((15 * MIN - 6000) / 1000));
	});

	it('empat kegagalan belum mengunci', () => {
		const l = new LoginLimiter();
		for (let i = 0; i < 4; i++) l.fail('a|1', i);
		expect(l.check('a|1', 10).allowed).toBe(true);
	});

	it('login berhasil mereset hitungan', () => {
		const l = new LoginLimiter();
		for (let i = 0; i < 4; i++) l.fail('a|1', i);
		l.succeed('a|1');
		for (let i = 0; i < 4; i++) l.fail('a|1', 100 + i);
		expect(l.check('a|1', 200).allowed).toBe(true);
	});

	it('jendela berakhir setelah 15 menit', () => {
		const l = new LoginLimiter();
		for (let i = 0; i < 5; i++) l.fail('a|1', 0);
		expect(l.check('a|1', 15 * MIN - 1).allowed).toBe(false);
		expect(l.check('a|1', 15 * MIN).allowed).toBe(true);
		l.fail('a|1', 15 * MIN + 1);
		expect(l.check('a|1', 15 * MIN + 2).allowed).toBe(true); // hitungan baru dimulai dari 1
	});

	it('kunci lain tidak terpengaruh (login atau IP berbeda)', () => {
		const l = new LoginLimiter();
		for (let i = 0; i < 5; i++) l.fail('a|1', 0);
		expect(l.check('b|1', 1).allowed).toBe(true);
		expect(l.check('a|2', 1).allowed).toBe(true);
	});

	it('percobaan yang ditolak tidak memperpanjang jendela', () => {
		const l = new LoginLimiter();
		for (let i = 0; i < 5; i++) l.fail('a|1', 0);
		l.check('a|1', 10 * MIN);
		expect(l.check('a|1', 15 * MIN).allowed).toBe(true);
	});

	it('retryAfter minimal 1 detik', () => {
		const l = new LoginLimiter();
		for (let i = 0; i < 5; i++) l.fail('a|1', 0);
		const r = l.check('a|1', 15 * MIN - 1);
		expect(r.allowed).toBe(false);
		if (!r.allowed) expect(r.retryAfterSeconds).toBe(1);
	});

	it('membersihkan jendela lama agar peta tidak tumbuh tanpa batas', () => {
		const l = new LoginLimiter();
		for (let i = 0; i < 600; i++) l.fail(`k${i}|1`, 0);
		l.fail('baru|1', 20 * MIN);
		// akses internal hanya untuk memastikan pembersihan terjadi
		expect((l as unknown as { entries: Map<string, unknown> }).entries.size).toBeLessThan(10);
	});
});
