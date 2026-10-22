import { describe, expect, it } from 'vitest';
import { parsePortfolioForm } from './portfolio-form';

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

const valid = {
	title: 'Gathering PT Gamma Galaxy Center',
	location: 'Citumang-Pangandaran',
	event_date: '30 Jul-1 Agu 2026',
	event_type: 'Gathering',
	caption: '22 peserta',
	alt: 'Tim di sungai'
};

describe('parsePortfolioForm', () => {
	it('menerima teks lengkap dan mewajibkan alt hanya bila foto tersimpan', () => {
		const withPhoto = parsePortfolioForm(form(valid), true);
		expect(withPhoto.ok).toBe(true);
		const noAlt = parsePortfolioForm(form({ ...valid, alt: '  ' }), false);
		expect(noAlt.ok).toBe(true);
		const missingAlt = parsePortfolioForm(form({ ...valid, alt: '' }), true);
		expect(missingAlt.ok).toBe(false);
		if (!missingAlt.ok) expect(missingAlt.errors.alt).toMatch(/wajib/);
	});

	it('menolak judul kosong', () => {
		const parsed = parsePortfolioForm(form({ ...valid, title: ' ' }), false);
		expect(parsed.ok).toBe(false);
	});
});
