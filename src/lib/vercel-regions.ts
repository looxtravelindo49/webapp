/** Region fungsi Vercel bawaan: Tokyo, sama dengan lokasi database Turso produksi. */
export const DEFAULT_VERCEL_REGIONS = ['hnd1'] as const;

/**
 * Region fungsi untuk adapter-vercel: `VERCEL_REGIONS` (dipisah koma) bila diisi,
 * selain itu `hnd1`. Tanpa nilai bawaan, Vercel menjalankan fungsi di `iad1` (AS)
 * sehingga setiap query ke Turso menyeberangi Pasifik.
 */
export function vercelRegions(env: Record<string, string | undefined>): string[] {
	const fromEnv = (env.VERCEL_REGIONS ?? '')
		.split(',')
		.map((r) => r.trim())
		.filter(Boolean);
	return fromEnv.length ? fromEnv : [...DEFAULT_VERCEL_REGIONS];
}
