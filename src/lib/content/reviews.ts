/** Halaman Google Maps tempat Loox Travel. Dipakai tombol lihat dan tulis ulasan. */
export const GOOGLE_REVIEWS_URL =
	'https://www.google.com/maps/place/Loox+Travel+-+PT+Loox+Travel+Luxury/@-6.810069,107.6206394,17z/data=!4m8!3m7!1s0x2e68e196d5f5124b:0x84f49e021326b3eb!8m2!3d-6.810069!4d107.6206394!9m1!1b1!16s%2Fg%2F11ytjl1nr1';

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
