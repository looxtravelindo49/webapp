export const LIMITS = {
	title: 120,
	category: 40,
	excerpt: 300,
	body: 20_000,
	coverAlt: 200
} as const;

import { PHOTO_ID } from './images';

export const UNSPLASH_INVALID_MESSAGE = 'Foto Unsplash tidak valid. Pilih foto lagi.';

export type UnsplashPick = { kind: 'none' } | { kind: 'id'; id: string } | { kind: 'error'; message: string };

/** Isian tersembunyi `unsplash_id` dari pemilih foto; kosong berarti tidak memilih. */
export function readUnsplashId(form: { get(name: string): unknown }): UnsplashPick {
	const v = form.get('unsplash_id');
	const id = typeof v === 'string' ? v.trim() : '';
	if (!id) return { kind: 'none' };
	return PHOTO_ID.test(id) ? { kind: 'id', id } : { kind: 'error', message: UNSPLASH_INVALID_MESSAGE };
}

export type ArticleValues = {
	title: string;
	category: string;
	excerpt: string;
	body: string;
	cover_alt: string | null;
	published: boolean;
	featured: boolean;
};

export type FieldName = 'title' | 'category' | 'excerpt' | 'body' | 'cover_alt';
export type ArticleErrors = Partial<Record<FieldName, string>>;
/** Nilai mentah untuk mengisi ulang form setelah gagal. */
export type ArticleRaw = Record<FieldName, string> & { published: boolean; featured: boolean };

export type ParseResult =
	| { ok: true; values: ArticleValues; raw: ArticleRaw }
	| { ok: false; errors: ArticleErrors; raw: ArticleRaw };

type FormLike = { get(name: string): unknown };
/** Kotak centang HTML: ada (bernilai apa pun selain kosong) = tercentang; tidak dikirim = tidak. */
const isChecked = (v: unknown) => v !== null && v !== undefined && v !== '';
const text = (form: FormLike, name: string) => {
	const v = form.get(name);
	return typeof v === 'string' ? v.replace(/\r\n?/g, '\n') : '';
};

/** Validasi masukan form artikel (tanpa berkas sampul, yang ditangani terpisah). */
export function parseArticleForm(form: FormLike): ParseResult {
	const raw: ArticleRaw = {
		title: text(form, 'title'),
		category: text(form, 'category'),
		excerpt: text(form, 'excerpt'),
		body: text(form, 'body'),
		cover_alt: text(form, 'cover_alt'),
		published: isChecked(form.get('published')),
		featured: isChecked(form.get('featured'))
	};
	const errors: ArticleErrors = {};

	const title = raw.title.trim();
	if (!title) errors.title = 'Judul wajib diisi.';
	else if (title.length > LIMITS.title) errors.title = `Judul maksimal ${LIMITS.title} karakter.`;

	const category = raw.category.trim();
	if (!category) errors.category = 'Kategori wajib diisi.';
	else if (category.length > LIMITS.category) errors.category = `Kategori maksimal ${LIMITS.category} karakter.`;

	const excerpt = raw.excerpt.trim();
	if (!excerpt) errors.excerpt = 'Ringkasan wajib diisi.';
	else if (excerpt.length > LIMITS.excerpt) errors.excerpt = `Ringkasan maksimal ${LIMITS.excerpt} karakter.`;

	const body = raw.body.trim();
	if (body.length > LIMITS.body) errors.body = `Isi artikel maksimal ${LIMITS.body.toLocaleString('id-ID')} karakter.`;
	else if (!body && raw.published) errors.body = 'Isi artikel wajib diisi sebelum diterbitkan.';

	const coverAlt = raw.cover_alt.trim();
	if (coverAlt.length > LIMITS.coverAlt) errors.cover_alt = `Teks alternatif maksimal ${LIMITS.coverAlt} karakter.`;

	if (Object.keys(errors).length > 0) return { ok: false, errors, raw };
	return {
		ok: true,
		raw,
		values: { title, category, excerpt, body, cover_alt: coverAlt || null, published: raw.published, featured: raw.featured }
	};
}

/** Isian form dari artikel tersimpan (halaman ubah). */
export function rawFromArticle(a: {
	title: string;
	category: string;
	excerpt: string;
	body: string;
	cover_alt: string | null;
	published: number;
	featured: number;
}): ArticleRaw {
	return {
		title: a.title,
		category: a.category,
		excerpt: a.excerpt,
		body: a.body,
		cover_alt: a.cover_alt ?? '',
		published: a.published === 1,
		featured: a.featured === 1
	};
}

export const emptyRaw = (): ArticleRaw => ({
	title: '', category: '', excerpt: '', body: '', cover_alt: '', published: false, featured: false
});
