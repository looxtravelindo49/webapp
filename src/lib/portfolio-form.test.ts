import { describe, expect, it } from 'vitest';
import { parsePortfolioBatch, parsePortfolioText } from './portfolio-form';

describe('parsePortfolioBatch', () => {
	it('menerima alt wajib dan keterangan kosong', () => {
		const parsed = parsePortfolioBatch(['  Tim di sungai  ', 'Jeep'], ['', '  '], 2);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.items).toEqual([{ alt: 'Tim di sungai', caption: null }, { alt: 'Jeep', caption: null }]);
	});

	it('menolak jumlah yang tidak sama, alt kosong, dan tanpa foto', () => {
		expect(parsePortfolioBatch(['A'], [], 2).ok).toBe(false);
		expect(parsePortfolioBatch([''], [], 1).ok).toBe(false);
		expect(parsePortfolioBatch([], [], 0).ok).toBe(false);
	});
});

describe('parsePortfolioText', () => {
	it('menyimpan keterangan hanya bila diisi', () => {
		expect(parsePortfolioText('Hutan', '  Senja ')).toEqual({ ok: true, alt: 'Hutan', caption: 'Senja' });
		expect(parsePortfolioText('Hutan', '   ')).toEqual({ ok: true, alt: 'Hutan', caption: null });
		expect(parsePortfolioText('  ', '')).toMatchObject({ ok: false });
	});
});
