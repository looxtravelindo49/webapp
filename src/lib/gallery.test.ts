import { describe, expect, it } from 'vitest';
import { GALLERY_INTERVAL_MS, slideAlt, stepGallery, swipeDirection, thumbnailIndexes } from './gallery';

describe('galeri', () => {
	it('jeda otomatis sekitar 4 detik', () => {
		expect(GALLERY_INTERVAL_MS).toBe(4000);
	});

	it('memutar indeks di kedua ujung', () => {
		expect(stepGallery(0, 4, -1)).toBe(3);
		expect(stepGallery(3, 4, 1)).toBe(0);
		expect(stepGallery(1, 4, 1)).toBe(2);
		expect(stepGallery(0, 0, 1)).toBe(0);
		expect(stepGallery(0, 1, 1)).toBe(0);
	});

	it('thumbnail adalah foto lain, tiga buah bila ada empat foto', () => {
		expect(thumbnailIndexes(4, 0)).toEqual([1, 2, 3]);
		expect(thumbnailIndexes(4, 2)).toEqual([0, 1, 3]);
		expect(thumbnailIndexes(1, 0)).toEqual([]);
		expect(thumbnailIndexes(0, 0)).toEqual([]);
	});

	it('gesekan horizontal melewati ambang; gerak kecil atau vertikal diabaikan', () => {
		expect(swipeDirection(-40, 0)).toBe(1);
		expect(swipeDirection(50, 10)).toBe(-1);
		expect(swipeDirection(39, 0)).toBe(0);
		expect(swipeDirection(-80, 80)).toBe(0);
		expect(swipeDirection(0, -100)).toBe(0);
	});

	it('alt kosong memakai cadangan', () => {
		expect(slideAlt('  Jeep  ', 'Paket')).toBe('Jeep');
		expect(slideAlt('  ', 'Paket')).toBe('Paket');
		expect(slideAlt(null, 'Paket')).toBe('Paket');
	});
});
