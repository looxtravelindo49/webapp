import { describe, expect, it } from 'vitest';
import { clearPlacesCache, fetchGoogleReviews, mapPlaceReviews } from './places';

describe('mapPlaceReviews', () => {
	it('hanya menyalin ulasan lengkap dari Google dan membuang yang kosong', () => {
		const mapped = mapPlaceReviews({
			status: 'OK',
			result: {
				reviews: [
					{ author_name: 'Rina', rating: 5, text: '  Timnya rapi. ', time: 1_780_000_000, author_url: 'https://maps.google.com/rina' },
					{ author_name: 'Tanpa teks', rating: 4, text: '   ', time: 1_780_000_001 },
					{ author_name: '', rating: 5, text: 'Hilang namanya', time: 1_780_000_002 },
					{ author_name: 'Aneh', rating: 9, text: 'Nilai tidak valid', time: 1_780_000_003 }
				]
			}
		});
		expect(mapped).toHaveLength(1);
		expect(mapped?.[0]).toMatchObject({ name: 'Rina', rating: 5, text: 'Timnya rapi.', url: 'https://maps.google.com/rina' });
		expect(mapped?.[0].date).toMatch(/2026/);
	});

	it('status gagal mengembalikan null, bukan daftar kosong', () => {
		expect(mapPlaceReviews({ status: 'REQUEST_DENIED' })).toBeNull();
		expect(mapPlaceReviews({ status: 'ZERO_RESULTS' })).toEqual([]);
	});
});

describe('fetchGoogleReviews', () => {
	it('tanpa kunci tidak memanggil jaringan', async () => {
		clearPlacesCache();
		let called = false;
		const reviews = await fetchGoogleReviews({}, () => {
			called = true;
			return Promise.reject(new Error('tidak boleh dipanggil'));
		});
		expect(reviews).toBeNull();
		expect(called).toBe(false);
	});

	it('memakai jawaban API dan tidak mengarang ulasan tambahan', async () => {
		clearPlacesCache();
		const reviews = await fetchGoogleReviews({ GOOGLE_PLACES_API_KEY: 'kunci', GOOGLE_PLACE_ID: 'ChIJ' }, async (input) => {
			const url = new URL(String(input));
			expect(url.searchParams.get('place_id')).toBe('ChIJ');
			expect(url.searchParams.get('fields')).toBe('reviews');
			return new Response(JSON.stringify({ status: 'OK', result: { reviews: [] } }));
		});
		expect(reviews).toEqual([]);
	});
});
