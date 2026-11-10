import { describe, expect, it } from 'vitest';
import { formatGoogleSummary, GOOGLE_REVIEWS_URL, parseGoogleSummary } from './reviews';
import { businessProfile } from './site';

describe('GOOGLE_REVIEWS_URL', () => {
	it('sama dengan URL tempat Google Maps di profil bisnis (satu sumber untuk ulasan dan JSON-LD)', () => {
		expect(GOOGLE_REVIEWS_URL).toBe(businessProfile.mapsUrl);
		expect(GOOGLE_REVIEWS_URL).toMatch(/^https:\/\/www\.google\.com\/maps\/place\/Loox\+Travel/);
		expect(GOOGLE_REVIEWS_URL).toContain('0x2e68e196d5f5124b:0x84f49e021326b3eb');
	});
});

describe('parseGoogleSummary', () => {
	it('menormalkan 5 dan 5,0 menjadi 5.0 dari 41 ulasan Google', () => {
		for (const raw of ['5', '5.0', '5,0']) {
			const parsed = parseGoogleSummary(raw, '41');
			expect(parsed.ok).toBe(true);
			if (parsed.ok) expect(formatGoogleSummary(parsed.rating, parsed.count)).toBe('5.0 dari 41 ulasan Google');
		}
	});

	it('menolak nilai di luar 1.0–5.0 dan jumlah kosong', () => {
		expect(parseGoogleSummary('5.1', '41').ok).toBe(false);
		expect(parseGoogleSummary('0', '41').ok).toBe(false);
		expect(parseGoogleSummary('4.85', '41').ok).toBe(false);
		expect(parseGoogleSummary('5.0', '').ok).toBe(false);
		expect(parseGoogleSummary('5.0', '0').ok).toBe(false);
	});
});
