/** Origin kanonik. Apex `lembangadventure.com` mengarah 308 ke www, jadi semua URL publik memakai www. */
export const CANONICAL_ORIGIN = 'https://www.lembangadventure.com';

/**
 * Alamat publik situs (origin tanpa garis miring akhir), dari PUBLIC_SITE_URL.
 * `lembangadventure.com` dan `www.lembangadventure.com` selalu menjadi `https://www.lembangadventure.com`.
 * Host lain (localhost, pratinjau) dibiarkan agar tes dan deployment pratinjau tetap benar.
 */
export function siteUrl(raw: string = process.env.PUBLIC_SITE_URL || 'http://localhost:3000'): string {
	try {
		const url = new URL(raw);
		const host = url.hostname.toLowerCase();
		if (host === 'lembangadventure.com' || host === 'www.lembangadventure.com') return CANONICAL_ORIGIN;
		return url.origin;
	} catch {
		return 'http://localhost:3000';
	}
}
