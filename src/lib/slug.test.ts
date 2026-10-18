import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
	it('memakai cadangan yang diberikan bila tidak ada karakter valid', () => {
		expect(slugify('!!!', 'artikel')).toBe('artikel');
		expect(slugify('Tips', 'artikel')).toBe('tips');
	});

	it.each([
		['Flying Fox Lembang', 'flying-fox-lembang'],
		['Café & Ñandú 100%!', 'cafe-nandu-100'],
		['  Rafting  ', 'rafting'],
		['Fun   Games---Seru', 'fun-games-seru'],
		['日本語', 'paket'],
		['!!!', 'paket'],
		['', 'paket']
	])('%j → %j', (input, expected) => expect(slugify(input)).toBe(expected));

	it('maksimal 60 karakter dan tidak berakhir dengan tanda hubung', () => {
		const slug = slugify('a'.repeat(59) + ' bbbbbb');
		expect(slug.length).toBeLessThanOrEqual(60);
		expect(slug.endsWith('-')).toBe(false);
	});

	it('hanya berisi a-z, 0-9, dan tanda hubung', () => {
		expect(slugify('Ünïcödé / Tést_#1 (baru)')).toMatch(/^[a-z0-9-]+$/);
	});
});

describe('uniqueSlug', () => {
	it('mengembalikan dasar bila belum dipakai', () => {
		expect(uniqueSlug('rafting', ['offroad'])).toBe('rafting');
	});
	it('menambah -2, -3, … saat bentrok', () => {
		expect(uniqueSlug('rafting', ['rafting'])).toBe('rafting-2');
		expect(uniqueSlug('rafting', ['rafting', 'rafting-2'])).toBe('rafting-3');
		expect(uniqueSlug('rafting', new Set(['rafting', 'rafting-3']))).toBe('rafting-2');
	});
});
