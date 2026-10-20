import { describe, expect, it } from 'vitest';
import { formatPriceTag, packageMetaDescription, packageShortName, visibleDuration } from './package-display';

describe('tampilan katalog paket', () => {
	it('nama singkat: tiga kata memakai kata pertama', () => {
		expect(packageShortName('Offroad Land Rover')).toBe('Offroad');
		expect(packageShortName('Team Building')).toBe('Team Building');
		expect(packageShortName('  Fun   Games  ')).toBe('Fun Games');
		expect(packageShortName('Offroad')).toBe('Offroad');
	});

	it('harga kartu dibulatkan ke rb atau jt', () => {
		expect(formatPriceTag(249_000)).toBe('Rp249rb/orang');
		expect(formatPriceTag(80_000)).toBe('Rp80rb/orang');
		expect(formatPriceTag(1_750_000)).toBe('Rp1,75jt/orang');
		expect(formatPriceTag(1_000_000)).toBe('Rp1jt/orang');
		expect(formatPriceTag(249_500)).toBe('Rp 249.500/orang');
		expect(formatPriceTag(null)).toBeNull();
	});

	it('durasi kosong disembunyikan', () => {
		expect(visibleDuration('  2-3 Jam  ')).toBe('2-3 Jam');
		expect(visibleDuration('')).toBeNull();
		expect(visibleDuration('   ')).toBeNull();
		expect(visibleDuration(null)).toBeNull();
	});

	it('deskripsi meta memotong di batas kata', () => {
		expect(packageMetaDescription('Keluar dari rutinitas.', '')).toBe('Keluar dari rutinitas.');
		const long = 'kata '.repeat(40).trim();
		const meta = packageMetaDescription(long, '');
		expect(meta.endsWith('…')).toBe(true);
		expect(meta.length).toBeLessThanOrEqual(160);
		expect(packageMetaDescription('', 'Kalimat pertama.\n\nLanjutan.')).toBe('Kalimat pertama.');
	});
});
