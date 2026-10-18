import { describe, expect, it } from 'vitest';
import { LIMITS, MIN_PAX_MESSAGE, PRICE_MESSAGE, emptyRaw, normalizeIncludes, parseMinPax, parsePackageForm, parsePrice, rawFromPackage } from './package-form';

const form = (fields: Record<string, string>) => new Map(Object.entries(fields)) as unknown as { get(n: string): string | undefined };
const base = { title: 'Rafting', summary: 'Seru bersama tim.' };

describe('parsePrice', () => {
	it.each([
		['250000', 250000],
		['250.000', 250000],
		['Rp 250.000', 250000],
		['Rp250000', 250000],
		['rp. 1.500.000', 1500000],
		['  250000  ', 250000],
		['0', 0],
		['100.000.000', 100000000],
		['100000000', 100000000]
	])('menerima %j → %i', (input, value) => expect(parsePrice(input)).toEqual({ ok: true, value }));

	it.each(['', '   ', 'Rp', 'Rp '])('kosong %j → null', (input) => expect(parsePrice(input)).toEqual({ ok: true, value: null }));

	it.each([
		'250.5', // titik desimal: jangan diam-diam jadi 2505
		'250,5',
		'250rb',
		'2.5jt',
		'-1',
		'-250.000',
		'100000001',
		'100.000.001',
		'1.2345',
		'12.34',
		'25.0000',
		'abc',
		'25 000',
		'1e6',
		'Rp -5'
	])('menolak %j', (input) => expect(parsePrice(input)).toEqual({ ok: false }));
});

describe('parseMinPax', () => {
	it.each([['1', 1], ['10', 10], ['10000', 10000], [' 7 ', 7], ['', 1], ['   ', 1]])('%j → %i', (input, value) =>
		expect(parseMinPax(input)).toEqual({ ok: true, value })
	);
	it.each(['0', '-2', '2.5', '10001', 'abc', '1e2', '3 orang'])('menolak %j', (input) => expect(parseMinPax(input)).toEqual({ ok: false }));
});

describe('normalizeIncludes', () => {
	it('memangkas, membuang baris kosong, dan menormalkan CRLF', () => {
		expect(normalizeIncludes('  satu \r\n\r\n dua\n   \n tiga  ')).toBe('satu\ndua\ntiga');
		expect(normalizeIncludes('')).toBe('');
	});
});

describe('parsePackageForm', () => {
	it('berhasil dengan nilai ternormalisasi', () => {
		const r = parsePackageForm(
			form({ ...base, title: '  Rafting  ', body: ' isi ', includes: ' a \n\n b ', notes: ' n ', duration: ' 3 jam ', image_alt: ' alt ', price: 'Rp 200.000', min_pax: '10', published: 'on' })
		);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.values).toEqual({
				title: 'Rafting', summary: 'Seru bersama tim.', body: 'isi', includes: 'a\nb', notes: 'n', duration: '3 jam',
				image_alt: 'alt', price_per_person: 200000, min_pax: 10, published: true
			});
		}
	});

	it('bidang opsional kosong menjadi null/bawaan', () => {
		const r = parsePackageForm(form(base));
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.values).toMatchObject({ body: '', includes: '', notes: '', duration: null, image_alt: null, price_per_person: null, min_pax: 1, published: false });
		}
	});

	it('nama dan ringkasan wajib', () => {
		const r = parsePackageForm(form({ title: '   ', summary: '' }));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors).toEqual({ title: 'Nama paket wajib diisi.', summary: 'Ringkasan wajib diisi.' });
	});

	it.each([
		['title', 'x'.repeat(LIMITS.title + 1), 'Nama paket maksimal 100 karakter.'],
		['summary', 'x'.repeat(LIMITS.summary + 1), 'Ringkasan maksimal 300 karakter.'],
		['body', 'x'.repeat(LIMITS.body + 1), 'Penjelasan maksimal 5000 karakter.'],
		['includes', 'x'.repeat(LIMITS.includes + 1), 'Fasilitas maksimal 2000 karakter.'],
		['notes', 'x'.repeat(LIMITS.notes + 1), 'Catatan maksimal 2000 karakter.'],
		['duration', 'x'.repeat(LIMITS.duration + 1), 'Durasi maksimal 100 karakter.'],
		['image_alt', 'x'.repeat(LIMITS.imageAlt + 1), 'Teks alternatif maksimal 200 karakter.']
	])('batas %s terlampaui → pesan', (field, value, message) => {
		const r = parsePackageForm(form({ ...base, [field]: value }));
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[field as keyof typeof r.errors]).toBe(message);
	});

	it('tepat pada batas diterima', () => {
		const r = parsePackageForm(form({ title: 'x'.repeat(LIMITS.title), summary: 'y'.repeat(LIMITS.summary), body: 'z'.repeat(LIMITS.body) }));
		expect(r.ok).toBe(true);
	});

	it('baris kosong tidak dihitung pada batas fasilitas', () => {
		const lines = Array.from({ length: 100 }, () => 'butir fasilitas').join('\n\n\n');
		expect(parsePackageForm(form({ ...base, includes: lines })).ok).toBe(true);
	});

	it('harga dan minimal peserta tidak valid → pesan yang ditetapkan', () => {
		const r = parsePackageForm(form({ ...base, price: '250.5', min_pax: '0' }));
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.errors.price).toBe(PRICE_MESSAGE);
			expect(r.errors.min_pax).toBe(MIN_PAX_MESSAGE);
		}
	});

	it('mengembalikan nilai mentah (tidak dipangkas) agar form bisa diisi ulang', () => {
		const r = parsePackageForm(form({ title: '  ', summary: 'ringkas', price: '250.5', published: 'on', body: 'a\r\nb' }));
		expect(r.ok).toBe(false);
		expect(r.raw).toMatchObject({ title: '  ', summary: 'ringkas', price: '250.5', published: true, body: 'a\nb' });
	});

	it('published hanya benar bila kotak centang dikirim', () => {
		const a = parsePackageForm(form({ ...base, published: 'on' }));
		const b = parsePackageForm(form(base));
		expect(a.ok && a.values.published).toBe(true);
		expect(b.ok && b.values.published).toBe(false);
	});

	it('nilai non-string (mis. berkas) diperlakukan sebagai kosong', () => {
		const f = { get: (n: string) => (n === 'title' ? new File(['x'], 'a.txt') : n === 'summary' ? 'ok' : null) };
		const r = parsePackageForm(f);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.title).toBe('Nama paket wajib diisi.');
	});
});

describe('rawFromPackage / emptyRaw', () => {
	const base = {
		title: 'Offroad', summary: 's', body: 'b', includes: 'a\nb', notes: 'n', duration: '3 jam', image_alt: 'alt',
		price_per_person: 250000, min_pax: 4, published: 1
	};
	it('mengubah paket tersimpan menjadi isian teks', () => {
		expect(rawFromPackage(base)).toEqual({
			title: 'Offroad', summary: 's', body: 'b', includes: 'a\nb', notes: 'n', duration: '3 jam', image_alt: 'alt',
			price: '250000', min_pax: '4', published: true
		});
	});
	it('NULL menjadi teks kosong; harga 0 tetap "0"; draft', () => {
		const raw = rawFromPackage({ ...base, duration: null, image_alt: null, price_per_person: null, published: 0 });
		expect(raw).toMatchObject({ duration: '', image_alt: '', price: '', published: false });
		expect(rawFromPackage({ ...base, price_per_person: 0 }).price).toBe('0');
	});
	it('hasil tersimpan lolos parsePackageForm kembali ke nilai yang sama', () => {
		const raw = rawFromPackage(base);
		const parsed = parsePackageForm(new Map(Object.entries({ ...raw, published: '1' })));
		expect(parsed.ok && parsed.values).toMatchObject({ price_per_person: 250000, min_pax: 4, includes: 'a\nb' });
	});
	it('emptyRaw: semua kosong', () => {
		expect(Object.values(emptyRaw()).filter((v) => v !== '' && v !== false)).toEqual([]);
	});
});
