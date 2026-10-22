import type { PublicReview } from '#lib/content/reviews.js';
import type { Queryable } from './db';
import { fetchGoogleReviews } from './places.js';
import { listPublicTestimonials } from './testimonials.js';

/** Google dipakai hanya bila ada isinya. Daftar kosong atau kegagalan jatuh ke data admin. */
export function chooseReviews(google: PublicReview[] | null, admin: PublicReview[]): PublicReview[] {
	return google && google.length > 0 ? google : admin;
}

/** Ulasan Google bila API dikonfigurasi dan mengembalikan data; selain itu ulasan yang diisi admin. Kosong bila tidak ada. */
export async function loadPublicReviews(db: Queryable, env: Record<string, string | undefined> = process.env): Promise<PublicReview[]> {
	return chooseReviews(await fetchGoogleReviews(env), await listPublicTestimonials(db));
}
