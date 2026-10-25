import { describe, expect, it } from 'vitest';
import { normalizeAddonIds, withAddons } from './addons';
import { calculateEstimate } from './pricing';
import type { Package } from './types';

const pkg = (slug: string, title: string, price: number | null): Package => ({
	id: 1,
	slug,
	title,
	summary: '',
	body: '',
	includes: '',
	notes: '',
	image: null,
	image_alt: null,
	duration: null,
	price_per_person: price,
	min_pax: 1,
	published: 1,
	sort_order: 1
});

describe('tambahan kalkulator', () => {
	it('membuang id asing dan memilih satu dokumentasi terakhir', () => {
		expect(normalizeAddonIds(['bukan', 'dok-pro', 'liwet', 'dok-basic', 'dok-pro'])).toEqual(['liwet', 'dok-pro']);
		expect(normalizeAddonIds(['dok-basic'])).toEqual(['dok-basic']);
		expect(normalizeAddonIds([])).toEqual([]);
	});

	it('liwet mengikuti jumlah peserta, dokumentasi harga tetap', () => {
		const base = calculateEstimate([pkg('offroad', 'Offroad', 250_000)], ['offroad'], 10);
		const estimate = withAddons(base, ['liwet', 'dok-basic'], 10);
		expect(estimate.total).toBe(2_500_000 + 500_000 + 700_000);
		expect(estimate.lines.map((line) => line.title)).toEqual([
			'Offroad',
			'Makan siang Liwet di hutan',
			'Dokumentasi Basic (Foto & Video cinematic, 4 jam)'
		]);
		expect(estimate.lines[1]).toMatchObject({ billedPax: 10, subtotal: 500_000, addon: true });
		expect(estimate.lines[2]).toMatchObject({ flat: true, subtotal: 700_000, addon: true });
	});

	it('tidak menambah apa pun tanpa paket atau peserta valid', () => {
		const empty = calculateEstimate([pkg('offroad', 'Offroad', 1000)], [], 10);
		expect(withAddons(empty, ['liwet'], 10).state).toBe('empty');
		const invalid = calculateEstimate([pkg('offroad', 'Offroad', 1000)], ['offroad'], null);
		expect(withAddons(invalid, ['dok-pro'], null).total).toBe(0);
	});
});
