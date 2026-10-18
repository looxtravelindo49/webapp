import { describe, expect, it } from 'vitest';
import { calculateEstimate, parsePax } from './pricing';
import type { Package } from './types';

const pkg = (slug: string, price: number | null, min_pax = 1): Package => ({
	id: 1,
	slug,
	title: slug.toUpperCase(),
	summary: '',
	body: '',
	includes: '',
	notes: '',
	image: null,
	image_alt: null,
	duration: null,
	price_per_person: price,
	min_pax,
	published: 1,
	sort_order: 1
});

const offroad = pkg('offroad', 250000);
const paintball = pkg('paintball', 150000);
const rafting = pkg('rafting', 200000, 10);
const fun = pkg('fun-games', null);
const all = [offroad, rafting, paintball, fun];

describe('parsePax', () => {
	it.each([
		['40', 40],
		[' 7 ', 7],
		['1', 1],
		['10000', 10000],
		[25, 25]
	])('menerima %j', (input, expected) => expect(parsePax(input)).toBe(expected));

	it.each(['0', '-3', '2.5', '10001', '', '  ', 'abc', '1e2', '4 0', null, undefined, 0, 2.5, -1])(
		'menolak %j',
		(input) => expect(parsePax(input as string)).toBeNull()
	);
});

describe('calculateEstimate', () => {
	it('satu paket: 250.000 × 40 = 10.000.000', () => {
		const e = calculateEstimate(all, ['offroad'], 40);
		expect(e.state).toBe('complete');
		expect(e.lines).toHaveLength(1);
		expect(e.lines[0]).toMatchObject({ billedPax: 40, subtotal: 10_000_000, minApplied: false });
		expect(e.total).toBe(10_000_000);
	});

	it('beberapa paket dijumlahkan', () => {
		const e = calculateEstimate(all, ['offroad', 'paintball'], 40);
		expect(e.lines.map((l) => l.subtotal)).toEqual([10_000_000, 6_000_000]);
		expect(e.total).toBe(16_000_000);
		expect(e.pricedCount).toBe(2);
	});

	it('menagih minimal peserta bila peserta kurang dari min_pax', () => {
		const e = calculateEstimate(all, ['rafting'], 4);
		expect(e.lines[0]).toMatchObject({ billedPax: 10, minApplied: true, subtotal: 2_000_000 });
		expect(e.total).toBe(2_000_000);
	});

	it('tidak menandai min_pax bila peserta mencukupi', () => {
		const e = calculateEstimate(all, ['rafting'], 10);
		expect(e.lines[0]).toMatchObject({ billedPax: 10, minApplied: false });
	});

	it('sebagian tanpa harga: baris null, tidak masuk total, state partial', () => {
		const e = calculateEstimate(all, ['offroad', 'fun-games'], 40);
		expect(e.state).toBe('partial');
		expect(e.total).toBe(10_000_000);
		expect(e.unpricedCount).toBe(1);
		expect(e.lines.find((l) => l.slug === 'fun-games')).toMatchObject({ price: null, subtotal: null });
	});

	it('semua tanpa harga: state quote-only dan total 0', () => {
		const e = calculateEstimate(all, ['fun-games'], 40);
		expect(e.state).toBe('quote-only');
		expect(e.total).toBe(0);
		expect(e.pricedCount).toBe(0);
		expect(e.lines).toHaveLength(1);
	});

	it('tanpa pilihan: state empty', () => {
		expect(calculateEstimate(all, [], 40).state).toBe('empty');
		expect(calculateEstimate(all, [], null).state).toBe('empty');
	});

	it('peserta tidak valid: state invalid-pax', () => {
		const e = calculateEstimate(all, ['offroad'], null);
		expect(e.state).toBe('invalid-pax');
		expect(e.lines).toEqual([]);
		expect(e.total).toBe(0);
	});

	it('mengabaikan slug usang', () => {
		const e = calculateEstimate(all, ['offroad', 'sudah-dihapus'], 10);
		expect(e.lines.map((l) => l.slug)).toEqual(['offroad']);
		expect(e.total).toBe(2_500_000);
		expect(calculateEstimate(all, ['sudah-dihapus'], 10).state).toBe('empty');
	});

	it('urutan baris mengikuti urutan paket, bukan urutan pemilihan', () => {
		const e = calculateEstimate(all, ['paintball', 'offroad'], 1);
		expect(e.lines.map((l) => l.slug)).toEqual(['offroad', 'paintball']);
	});

	it('menerima Set sebagai pilihan', () => {
		expect(calculateEstimate(all, new Set(['offroad']), 2).total).toBe(500_000);
	});

	it('menjaga nilai tetap bilangan bulat pada peserta maksimum', () => {
		const e = calculateEstimate(all, ['offroad', 'paintball'], 10000);
		expect(e.total).toBe(4_000_000_000);
		expect(Number.isInteger(e.total)).toBe(true);
	});
});
