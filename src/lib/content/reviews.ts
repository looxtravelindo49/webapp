import { businessProfile } from './site';

/** Halaman Google Maps tempat Loox Travel. Dipakai tombol lihat dan tulis ulasan, serta `hasMap` JSON-LD. */
export const GOOGLE_REVIEWS_URL: string = businessProfile.mapsUrl;

export const GOOGLE_RATING_SETTING = 'google_rating';
export const GOOGLE_REVIEW_COUNT_SETTING = 'google_review_count';

/** `5.0 dari 41 ulasan Google`. Nilai sudah dinormalisasi ke satu angka di belakang koma. */
export function formatGoogleSummary(rating: string, count: number): string {
	return `${rating} dari ${count} ulasan Google`;
}

/** Terima `5`, `5.0`, atau `5,0` dan jumlah bulat. Tolak di luar 1.0–5.0. */
export function parseGoogleSummary(
	ratingRaw: string,
	countRaw: string
): { ok: true; rating: string; count: number } | { ok: false; error: string } {
	const ratingText = ratingRaw.trim().replace(',', '.');
	const countText = countRaw.trim();
	if (!/^(?:[1-4](?:\.\d)?|5(?:\.0)?)$/.test(ratingText)) {
		return { ok: false, error: 'Nilai antara 1.0 dan 5.0, dengan satu angka di belakang koma.' };
	}
	if (!/^[1-9]\d{0,5}$/.test(countText)) {
		return { ok: false, error: 'Jumlah ulasan harus bilangan bulat, minimal 1.' };
	}
	return { ok: true, rating: Number(ratingText).toFixed(1), count: Number(countText) };
}

export type PublicReview = {
	id: string;
	name: string;
	rating: number;
	text: string;
	date: string;
	url: string | null;
};
