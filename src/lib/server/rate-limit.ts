import { one, run, type Queryable } from './db';

export type LimitCheck = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Pembatas percobaan login berbasis database: `max` kegagalan dalam jendela `windowMs` per kunci
 * (login|ip). Hitungan dibagi antar instance dan bertahan saat restart. `check` lalu `fail` dari dua
 * permintaan paralel dapat meloloskan satu-dua percobaan ekstra (batas lunak, bukan jaminan mutlak).
 */
export class LoginLimiter {
	constructor(
		private readonly db: Queryable,
		private readonly max = 5,
		private readonly windowMs = 15 * 60 * 1000
	) {}

	async check(key: string, now: number): Promise<LimitCheck> {
		const e = await one<{ count: number; window_start: number }>(
			this.db,
			'SELECT count, window_start FROM login_attempt WHERE key = ?',
			[key]
		);
		if (!e) return { allowed: true };
		if (now - e.window_start >= this.windowMs) return { allowed: true };
		if (e.count >= this.max) {
			return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((e.window_start + this.windowMs - now) / 1000)) };
		}
		return { allowed: true };
	}

	/** Catat satu kegagalan: menaikkan hitungan, atau memulai jendela baru bila yang lama sudah lewat. */
	async fail(key: string, now: number): Promise<void> {
		// Buang jendela yang sudah lewat agar tabel tidak tumbuh tanpa batas.
		await run(this.db, 'DELETE FROM login_attempt WHERE window_start <= ?', [now - this.windowMs]);
		await run(
			this.db,
			`INSERT INTO login_attempt (key, count, window_start) VALUES (?, 1, ?)
			 ON CONFLICT(key) DO UPDATE SET
			   count = CASE WHEN ? - window_start >= ? THEN 1 ELSE count + 1 END,
			   window_start = CASE WHEN ? - window_start >= ? THEN ? ELSE window_start END`,
			[key, now, now, this.windowMs, now, this.windowMs, now]
		);
	}

	async succeed(key: string): Promise<void> {
		await run(this.db, 'DELETE FROM login_attempt WHERE key = ?', [key]);
	}
}
