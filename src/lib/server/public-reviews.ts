import { formatGoogleSummary, GOOGLE_RATING_SETTING, GOOGLE_REVIEW_COUNT_SETTING, parseGoogleSummary, type PublicReview } from '#lib/content/reviews.js';
import type { Queryable } from './db';
import { fetchGoogleReviews } from './places.js';
import { getSetting } from './settings.js';
import { listPublicTestimonials } from './testimonials.js';

/** Google dipakai hanya bila ada isinya. Daftar kosong atau kegagalan jatuh ke data admin. */
export function chooseReviews(google: PublicReview[] | null, admin: PublicReview[]): PublicReview[] {
	return google && google.length > 0 ? google : admin;
}

/** Ulasan Google bila API dikonfigurasi dan mengembalikan data; selain itu ulasan yang diisi admin. Kosong bila tidak ada. */
export async function loadPublicReviews(db: Queryable, env: Record<string, string | undefined> = process.env): Promise<PublicReview[]> {
	return chooseReviews(await fetchGoogleReviews(env), await listPublicTestimonials(db));
}

/** Baris ringkasan di beranda, misalnya `5.0 dari 41 ulasan Google`. `null` bila pengaturan belum ada atau tidak valid. */
export async function loadGoogleSummary(db: Queryable): Promise<string | null> {
	const rating = await getSetting(db, GOOGLE_RATING_SETTING);
	const count = await getSetting(db, GOOGLE_REVIEW_COUNT_SETTING);
	if (rating == null || count == null) return null;
	const parsed = parseGoogleSummary(rating, count);
	return parsed.ok ? formatGoogleSummary(parsed.rating, parsed.count) : null;
}
