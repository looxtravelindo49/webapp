export const TESTIMONIAL_LIMITS = { name: 80, body: 1000 } as const;

export type TestimonialRaw = {
	name: string;
	rating: string;
	body: string;
	date: string;
	url: string;
};

export type TestimonialValues = {
	name: string;
	rating: number;
	body: string;
	date: string;
	url: string | null;
};

export type TestimonialErrors = Partial<Record<'name' | 'rating' | 'body' | 'date' | 'url', string>>;

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

export function emptyTestimonialRaw(): TestimonialRaw {
	return { name: '', rating: '5', body: '', date: '', url: '' };
}

/** Hanya http(s). Kosong diizinkan. */
export function optionalHttpUrl(raw: string): string | null | 'bad' {
	const value = raw.trim();
	if (!value) return null;
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'bad';
		return url.toString();
	} catch {
		return 'bad';
	}
}

export function parseTestimonialForm(form: FormData): { raw: TestimonialRaw; ok: true; values: TestimonialValues } | { raw: TestimonialRaw; ok: false; errors: TestimonialErrors } {
	const raw: TestimonialRaw = {
		name: text(form, 'reviewer_name'),
		rating: text(form, 'rating'),
		body: text(form, 'body'),
		date: text(form, 'review_date'),
		url: text(form, 'source_url')
	};
	const errors: TestimonialErrors = {};
	const name = raw.name.trim();
	const body = raw.body.trim();
	const date = raw.date.trim();
	const rating = Number(raw.rating);
	if (!name) errors.name = 'Nama pemberi ulasan wajib diisi.';
	else if (name.length > TESTIMONIAL_LIMITS.name) errors.name = `Nama maksimal ${TESTIMONIAL_LIMITS.name} karakter.`;
	if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Nilai harus bilangan 1 sampai 5.';
	if (!body) errors.body = 'Teks ulasan wajib diisi.';
	else if (body.length > TESTIMONIAL_LIMITS.body) errors.body = `Teks ulasan maksimal ${TESTIMONIAL_LIMITS.body} karakter.`;
	if (date) {
		const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
		const stamp = parts ? new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))) : null;
		if (!stamp || stamp.getUTCFullYear() !== Number(parts![1]) || stamp.getUTCMonth() + 1 !== Number(parts![2]) || stamp.getUTCDate() !== Number(parts![3])) {
			errors.date = 'Tanggal ulasan tidak valid.';
		}
	}
	const url = optionalHttpUrl(raw.url);
	if (url === 'bad') errors.url = 'Tautan harus berupa alamat http atau https, atau dikosongkan.';
	if (Object.keys(errors).length) return { raw, ok: false, errors };
	return { raw, ok: true, values: { name, rating, body, date, url } };
}

const shortDate = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** `2026-07-30` → tanggal singkat Indonesia. Nilai lain dikembalikan apa adanya. */
export function formatReviewDate(value: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const [y, m, d] = value.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	if (Number.isNaN(date.getTime())) return value;
	return shortDate.format(date);
}
