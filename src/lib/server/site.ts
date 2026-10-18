/** Alamat publik situs (origin tanpa garis miring akhir), dari PUBLIC_SITE_URL. */
export function siteUrl(): string {
	const raw = process.env.PUBLIC_SITE_URL || 'http://localhost:3000';
	try {
		return new URL(raw).origin;
	} catch {
		return 'http://localhost:3000';
	}
}
