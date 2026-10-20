import { describe, expect, it } from 'vitest';
import { calculateEstimate, manualPackagePrefill, parsePax } from './pricing';
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

describe('harga per satuan', () => {
	const car = 7 * 249_000;
	const offroadUnit = pkg('offroad', 249_000, 7);
	offroadUnit.pricing_mode = 'per_unit';
	offroadUnit.kapasitas_per_unit = 7;
	offroadUnit.nama_unit = 'mobil';
	const jeep = { ...pkg('jeep-tour', 249_000), pricing_mode: 'per_unit' as const, kapasitas_per_unit: 7, nama_unit: 'mobil' };

	it.each([
		[1, 1, car],
		[7, 1, car],
		[8, 2, car * 2],
		[14, 2, car * 2],
		[15, 3, car * 3],
		[20, 3, car * 3]
	])('%i peserta → %i mobil, total %i', (pax, units, total) => {
		const e = calculateEstimate([offroadUnit], ['offroad'], pax);
		expect(e.total).toBe(total);
		expect(e.lines[0]).toMatchObject({
			subtotal: total,
			minApplied: false,
			unit: { name: 'mobil', capacity: 7, count: units, price: car }
		});
		expect(e.lines[0].billedPax).toBe(units * 7);
	});

	it('berlaku lewat pengaturan paket, bukan lewat slug', () => {
		expect(calculateEstimate([jeep], ['jeep-tour'], 8).total).toBe(car * 2);
		const plain = pkg('offroad', 249_000, 7);
		expect(calculateEstimate([plain], ['offroad'], 8).total).toBe(249_000 * 8);
	});

	it('prefill invoice manual: qty mobil dan harga satu mobil', () => {
		expect(manualPackagePrefill({ title: 'Offroad', price: 249_000, pricing_mode: 'per_unit', kapasitas_per_unit: 7, nama_unit: 'mobil' }, '20')).toEqual({
			deskripsi: 'Offroad',
			qty: '3',
			harga: '1743000',
			unitName: 'mobil',
			capacity: '7'
		});
		expect(manualPackagePrefill({ title: 'Offroad', price: 249_000, pricing_mode: 'per_unit', kapasitas_per_unit: 7, nama_unit: 'mobil' }, '8').qty).toBe('2');
		expect(manualPackagePrefill({ title: 'Rafting', price: 125_000 }, '5')).toEqual({
			deskripsi: 'Rafting', qty: '5', harga: '125000', unitName: '', capacity: ''
		});
	});

	it('tanpa harga tetap harga menyusul', () => {
		const bare = { ...offroadUnit, price_per_person: null };
		const e = calculateEstimate([bare], ['offroad'], 8);
		expect(e.state).toBe('quote-only');
		expect(e.lines[0].subtotal).toBeNull();
		expect(e.lines[0].unit).toBeUndefined();
	});
});
