import type { PublicReview } from '#lib/content/reviews.js';

const CACHE_MS = 15 * 60 * 1000;
const jakarta = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });

type Cache = { placeId: string; at: number; reviews: PublicReview[] };
let cache: Cache | null = null;

type PlaceReview = {
	author_name?: unknown;
	author_url?: unknown;
	rating?: unknown;
	text?: unknown;
	time?: unknown;
};

/** Petakan jawaban Place Details. `null` bila status bukan sukses (pemanggil memakai data admin). */
export function mapPlaceReviews(body: unknown): PublicReview[] | null {
	if (!body || typeof body !== 'object') return null;
	const status = (body as { status?: unknown }).status;
	if (status !== 'OK' && status !== 'ZERO_RESULTS') return null;
	const raw = (body as { result?: { reviews?: unknown } }).result?.reviews;
	if (!Array.isArray(raw)) return [];
	const reviews: PublicReview[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const row = item as PlaceReview;
		const name = typeof row.author_name === 'string' ? row.author_name.trim() : '';
		const text = typeof row.text === 'string' ? row.text.trim() : '';
		const rating = typeof row.rating === 'number' ? row.rating : Number.NaN;
		const time = typeof row.time === 'number' ? row.time : Number.NaN;
		if (!name || !text || !Number.isInteger(rating) || rating < 1 || rating > 5 || !Number.isFinite(time)) continue;
		const url = typeof row.author_url === 'string' && /^https?:\/\//.test(row.author_url) ? row.author_url : null;
		reviews.push({
			id: `google-${time}-${name}`,
			name,
			rating,
			text,
			date: jakarta.format(new Date(time * 1000)),
			url
		});
	}
	return reviews;
}

export function clearPlacesCache(): void {
	cache = null;
}

/**
 * Ulasan dari Google Places bila `GOOGLE_PLACES_API_KEY` dan `GOOGLE_PLACE_ID` terisi.
 * Jalur ini dibiarkan, tetapi tetap mati: kedua variabel dikosongkan karena API-nya berbayar.
 * `null` bila tidak dikonfigurasi atau permintaan gagal, supaya pemanggil memakai data admin.
 */
export async function fetchGoogleReviews(
	env: Record<string, string | undefined> = process.env,
	fetchImpl: typeof fetch = fetch
): Promise<PublicReview[] | null> {
	const key = env.GOOGLE_PLACES_API_KEY?.trim();
	const placeId = env.GOOGLE_PLACE_ID?.trim();
	if (!key || !placeId) return null;
	if (cache && cache.placeId === placeId && Date.now() - cache.at < CACHE_MS) return cache.reviews;
	const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
	url.searchParams.set('place_id', placeId);
	url.searchParams.set('fields', 'reviews');
	url.searchParams.set('reviews_sort', 'newest');
	url.searchParams.set('language', 'id');
	url.searchParams.set('key', key);
	try {
		const res = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
		if (!res.ok) return null;
		const mapped = mapPlaceReviews(await res.json());
		if (!mapped) return null;
		cache = { placeId, at: Date.now(), reviews: mapped };
		return mapped;
	} catch (err) {
		console.error('[reviews] Google Places gagal:', err instanceof Error ? err.message : 'galat');
		return null;
	}
}
