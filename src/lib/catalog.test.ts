import { describe, expect, it } from 'vitest';
import { catalogLocation, catalogMatches, catalogPrice, unitPriceNote } from './catalog';

describe('catalogPrice', () => {
	it('memakai rupiah penuh, /pax* untuk per satuan, dan Minta penawaran bila kosong', () => {
		expect(catalogPrice({ price_per_person: 249000, pricing_mode: 'per_unit' })).toEqual({ amount: 'Rp249.000', unit: '/pax*' });
		expect(catalogPrice({ price_per_person: 80000, pricing_mode: 'per_person' })).toEqual({ amount: 'Rp80.000', unit: '/orang' });
		expect(catalogPrice({ price_per_person: 125000 })).toEqual({ amount: 'Rp125.000', unit: '/orang' });
		expect(catalogPrice({ price_per_person: null })).toEqual({ amount: 'Minta penawaran', unit: null });
	});
});

describe('catalogMatches', () => {
	it('Semua menampilkan semua, kategori hanya slug yang dikenal', () => {
		expect(catalogMatches('offroad', 'all')).toBe(true);
		expect(catalogMatches('paintball', 'adv')).toBe(true);
		expect(catalogMatches('rafting', 'adv')).toBe(true);
		expect(catalogMatches('fun-games', 'grup')).toBe(true);
		expect(catalogMatches('team-building', 'corp')).toBe(true);
		expect(catalogMatches('offroad', 'corp')).toBe(false);
		expect(catalogMatches('baru', 'adv')).toBe(false);
		expect(catalogMatches('baru', 'all')).toBe(true);
	});
});

describe('catalogLocation', () => {
	it('paket baru memakai durasi bila ada', () => {
		expect(catalogLocation({ slug: 'baru', duration: ' Sehari ' })).toBe('Lembang · Sehari');
		expect(catalogLocation({ slug: 'baru', duration: '  ' })).toBe('Lembang');
		expect(catalogLocation({ slug: 'paintball', duration: 'lain' })).toBe('Cikole, Lembang · Termasuk 40 peluru');
	});
});

describe('unitPriceNote', () => {
	it('menyebut Offroad per mobil', () => {
		expect(
			unitPriceNote({ slug: 'offroad', title: 'Offroad Cikole Lembang', pricing_mode: 'per_unit', kapasitas_per_unit: 7, nama_unit: 'mobil' })
		).toBe('*Offroad dihitung per mobil (maks. 7 orang/mobil). Harga final dikonfirmasi via WhatsApp.');
		expect(unitPriceNote({ slug: 'fun-games', title: 'Fun Games', pricing_mode: 'per_person', kapasitas_per_unit: null, nama_unit: null })).toBeNull();
	});
});
