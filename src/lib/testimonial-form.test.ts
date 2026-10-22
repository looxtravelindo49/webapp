import { describe, expect, it } from 'vitest';
import { formatReviewDate, parseTestimonialForm } from './testimonial-form';

const form = (fields: Record<string, string>) => {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
};

const valid = {
	reviewer_name: 'Sari',
	rating: '5',
	body: 'Kegiatan rapi.',
	review_date: '2026-07-30',
	source_url: 'https://maps.google.com/ulasan'
};

describe('parseTestimonialForm', () => {
	it('menerima ulasan lengkap dan tautan kosong', () => {
		const parsed = parseTestimonialForm(form(valid));
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.values).toMatchObject({ name: 'Sari', rating: 5, url: 'https://maps.google.com/ulasan' });
		const bare = parseTestimonialForm(form({ ...valid, source_url: '' }));
		expect(bare.ok && bare.values.url).toBeNull();
	});

	it('menerima tanggal kosong dan menolak tanggal palsu', () => {
		const parsed = parseTestimonialForm(form({ ...valid, review_date: '' }));
		expect(parsed.ok).toBe(true);
		if (parsed.ok) expect(parsed.values.date).toBe('');
		expect(parseTestimonialForm(form({ ...valid, rating: '6' })).ok).toBe(false);
		expect(parseTestimonialForm(form({ ...valid, review_date: '2026-02-31' })).ok).toBe(false);
		expect(parseTestimonialForm(form({ ...valid, source_url: 'javascript:alert(1)' })).ok).toBe(false);
	});
});

describe('formatReviewDate', () => {
	it('menampilkan tanggal singkat dan membiarkan teks lain', () => {
		expect(formatReviewDate('2026-07-30')).toMatch(/30/);
		expect(formatReviewDate('2026-07-30')).toMatch(/2026/);
		expect(formatReviewDate('30 Jul-1 Agu 2026')).toBe('30 Jul-1 Agu 2026');
		expect(formatReviewDate('')).toBe('');
	});
});
