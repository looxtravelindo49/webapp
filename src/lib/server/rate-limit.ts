export type LimitCheck = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Pembatas percobaan login di memori: `max` kegagalan dalam jendela `windowMs` per kunci
 * (login|ip). Hilang saat restart dan tidak dibagi antar instance (dipakai untuk satu proses).
 */
export class LoginLimiter {
	private entries = new Map<string, { count: number; start: number }>();

	constructor(
		private readonly max = 5,
		private readonly windowMs = 15 * 60 * 1000
	) {}

	check(key: string, now: number): LimitCheck {
		const e = this.entries.get(key);
		if (!e) return { allowed: true };
		if (now - e.start >= this.windowMs) {
			this.entries.delete(key);
			return { allowed: true };
		}
		if (e.count >= this.max) {
			return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((e.start + this.windowMs - now) / 1000)) };
		}
		return { allowed: true };
	}

	fail(key: string, now: number): void {
		this.sweep(now);
		const e = this.entries.get(key);
		if (!e || now - e.start >= this.windowMs) this.entries.set(key, { count: 1, start: now });
		else e.count++;
	}

	succeed(key: string): void {
		this.entries.delete(key);
	}

	/** Buang jendela yang sudah lewat agar peta tidak tumbuh tanpa batas. */
	private sweep(now: number): void {
		if (this.entries.size < 500) return;
		for (const [k, e] of this.entries) if (now - e.start >= this.windowMs) this.entries.delete(k);
	}
}

export const loginLimiter = new LoginLimiter();
