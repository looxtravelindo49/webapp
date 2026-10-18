import { resolve } from 'node:path';

export const PORT = process.env.E2E_PORT || '4180';
export const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
/** Database uji; pada mode server-berjalan diberikan lewat E2E_DB. */
export const DB_PATH = process.env.E2E_DB || resolve(process.cwd(), 'test-results/e2e-data/app.db');

export const DEFAULT_ADMIN_LOGIN = 'admin@looxtravel';
export const DEFAULT_ADMIN_PASSWORD = '12345678';
export const WA_NUMBER = '6282120209900';

/** Harga fixture (rupiah per orang). Team Building dan Fun Games sengaja tanpa harga (NULL). */
export const PRICES = {
	offroad: { price: 250_000, minPax: 1 },
	rafting: { price: 200_000, minPax: 10 },
	paintball: { price: 150_000, minPax: 1 }
} as const;
