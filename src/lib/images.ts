export const FALLBACK_IMAGE = '/media/forest.svg';

const SAFE = /^\/(media|uploads)\/[a-zA-Z0-9_./%-]+\.(svg|webp|png|jpe?g|avif)$/i;

/** Hanya path lokal /media/… atau /uploads/… tanpa `..`; selain itu pakai gambar bawaan. */
export function safeImage(path: string | null | undefined): string {
	return path && SAFE.test(path) && !path.includes('..') ? path : FALLBACK_IMAGE;
}

/** Path gambar yang aman, atau null bila kosong atau tidak dikenali. Tidak memakai gambar bawaan. */
export function optionalImage(path: string | null | undefined): string | null {
	return path && SAFE.test(path) && !path.includes('..') ? path : null;
}

// ---------------------------------------------------------------------------
// Foto Unsplash (hotlink): hanya URL dari images.unsplash.com yang dipercaya.
// ---------------------------------------------------------------------------

/** Id foto Unsplash yang dapat diterima dari form (juga dipakai server sebelum memanggil API). */
export const PHOTO_ID = /^[A-Za-z0-9_-]{6,40}$/;

/** Handler `onerror` gambar: foto Unsplash bisa dihapus fotografernya, jadi sekali gagal pakai gambar bawaan. */
export function useFallbackImage(e: Event): void {
	const img = e.currentTarget as HTMLImageElement;
	if (!img.src.endsWith(FALLBACK_IMAGE)) img.src = FALLBACK_IMAGE;
}

const UNSPLASH_PROFILE = /^https:\/\/unsplash\.com\/@[A-Za-z0-9_.-]+$/;

function parseUnsplashImage(url: string | null | undefined): URL | null {
	if (!url) return null;
	try {
		const u = new URL(url);
		const ok = u.protocol === 'https:' && u.hostname === 'images.unsplash.com' && !u.username && !u.password && !u.port;
		return ok ? u : null;
	} catch {
		return null;
	}
}

/** URL gambar Unsplash yang sah (`https://images.unsplash.com/…`). */
export const isUnsplashImage = (url: string | null | undefined): url is string => parseUnsplashImage(url) !== null;

/**
 * Tambah parameter ukuran ke `urls.raw` Unsplash tanpa menghapus parameter yang ada (`ixid` wajib tetap
 * agar Unsplash dapat menghitung tampilan). Bukan URL Unsplash yang sah → null.
 */
export function unsplashSized(raw: string | null | undefined, size: { w: number; h: number }): string | null {
	const u = parseUnsplashImage(raw);
	if (!u) return null;
	u.searchParams.set('w', String(size.w));
	u.searchParams.set('h', String(size.h));
	u.searchParams.set('fit', 'crop');
	u.searchParams.set('q', '80');
	u.searchParams.set('auto', 'format');
	return u.toString();
}

/** Sumber gambar sampul: foto Unsplash berukuran bila sah; selain itu gambar lokal yang aman atau bawaan. */
export function coverImage(cover: string | null | undefined, size: { w: number; h: number }): string {
	return unsplashSized(cover, size) ?? safeImage(cover);
}

/** Tautan profil fotografer yang sah (`https://unsplash.com/@nama`). */
export const isUnsplashProfile = (url: string | null | undefined): url is string => !!url && UNSPLASH_PROFILE.test(url);

export type Credit = { name: string; url: string | null };
export type CreditLinks = { name: string; profile: string | null; unsplash: string };

const utm = (base: string, source: string) => {
	const u = new URL(base);
	u.searchParams.set('utm_source', source);
	u.searchParams.set('utm_medium', 'referral');
	return u.toString();
};

/** Tautan kredit ber-UTM; tautan profil hanya bila berpola `https://unsplash.com/@…`. */
export function creditLinks(credit: Credit, utmSource: string): CreditLinks {
	return {
		name: credit.name,
		profile: isUnsplashProfile(credit.url) ? utm(credit.url, utmSource) : null,
		unsplash: utm('https://unsplash.com/', utmSource)
	};
}
