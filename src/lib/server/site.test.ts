import { describe, expect, it } from 'vitest';
import { CANONICAL_ORIGIN, siteUrl } from './site';

describe('siteUrl', () => {
	it('menjadikan domain produksi sebagai https://www.lembangadventure.com', () => {
		expect(CANONICAL_ORIGIN).toBe('https://www.lembangadventure.com');
		expect(siteUrl('https://lembangadventure.com')).toBe(CANONICAL_ORIGIN);
		expect(siteUrl('http://lembangadventure.com/artikel')).toBe(CANONICAL_ORIGIN);
		expect(siteUrl('https://www.lembangadventure.com/')).toBe(CANONICAL_ORIGIN);
		expect(siteUrl('https://WWW.LembangAdventure.com')).toBe(CANONICAL_ORIGIN);
	});

	it('membiarkan host lain, termasuk server uji', () => {
		expect(siteUrl('http://127.0.0.1:4180')).toBe('http://127.0.0.1:4180');
		expect(siteUrl('http://localhost:3000/x')).toBe('http://localhost:3000');
		expect(siteUrl('https://preview.vercel.app')).toBe('https://preview.vercel.app');
	});

	it('nilai kosong atau rusak jatuh ke localhost', () => {
		expect(siteUrl('')).toBe('http://localhost:3000');
		expect(siteUrl('bukan-url')).toBe('http://localhost:3000');
	});
});
