/** Pencarian Google Maps untuk profil bisnis. Dipakai bila Place ID belum diketahui. */
export const GOOGLE_REVIEWS_URL =
	'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Loox Travel Lembang Bandung');

export type PublicReview = {
	id: string;
	name: string;
	rating: number;
	text: string;
	date: string;
	url: string | null;
};
