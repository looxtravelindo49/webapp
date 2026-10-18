import type { ArticleValues } from '#lib/article-form.js';
import { slugify, uniqueSlug } from '#lib/slug.js';
import type { Article, ArticleSummary } from '#lib/types.js';
import { all, column, one, run, transaction, type Db, type Queryable } from './db';

export type { Article, ArticleSummary };

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";
const summaryColumns = `id, slug, title, category, excerpt, cover_image, cover_alt, cover_credit_name, cover_credit_url,
	cover_unsplash_id, published, featured, published_at, created_at, updated_at`;
const columns = `${summaryColumns}, body`;

/** Artikel terbit untuk `/artikel`: terbaru dulu. */
export function listPublishedArticles(db: Queryable): Promise<ArticleSummary[]> {
	return all<ArticleSummary>(
		db,
		`SELECT ${summaryColumns} FROM article WHERE published = 1 ORDER BY published_at DESC, id DESC`
	);
}

/** Maksimal tiga artikel populer untuk beranda: unggulan dulu, sisanya diisi artikel terbit terbaru. */
export function listPopularArticles(db: Queryable, limit = 3): Promise<ArticleSummary[]> {
	return all<ArticleSummary>(
		db,
		`SELECT ${summaryColumns} FROM article WHERE published = 1
		 ORDER BY featured DESC, published_at DESC, id DESC LIMIT ?`,
		[limit]
	);
}

/** Semua artikel (termasuk draf) untuk admin, yang terakhir diperbarui dulu. */
export function listAllArticles(db: Queryable): Promise<ArticleSummary[]> {
	return all<ArticleSummary>(db, `SELECT ${summaryColumns} FROM article ORDER BY updated_at DESC, id DESC`);
}

/** `id` yang bukan bilangan bulat berarti tidak ada; libSQL menolak NaN sebagai argumen. */
export async function getArticle(db: Queryable, id: number): Promise<Article | null> {
	if (!Number.isInteger(id)) return null;
	return one<Article>(db, `SELECT ${columns} FROM article WHERE id = ?`, [id]);
}

/** Artikel terbit menurut slug; draf dan slug tak dikenal → null. */
export function getPublishedArticleBySlug(db: Queryable, slug: string): Promise<Article | null> {
	return one<Article>(db, `SELECT ${columns} FROM article WHERE slug = ? AND published = 1`, [slug]);
}

/** Foto Unsplash sebagai sampul: id, nama fotografer, dan tautan profilnya (sudah divalidasi). */
export type UnsplashCover = { id: string; name: string; url: string | null };

/**
 * Buat artikel baru: selalu draf dan tidak unggulan, slug otomatis dan unik.
 * `cover` adalah path sampul (mis. `/uploads/<uuid>.png`), URL foto Unsplash, atau null; `unsplash`
 * (kredit foto) hanya diberikan bersama URL Unsplash.
 */
export function createArticle(db: Db, values: ArticleValues, cover: string | null, unsplash?: UnsplashCover | null): Promise<Article> {
	return transaction(db, async (tx) => {
		const taken = await column<string>(tx, 'SELECT slug FROM article');
		const slug = uniqueSlug(slugify(values.title, 'artikel'), taken);
		const info = await run(
			tx,
			`INSERT INTO article (slug, title, category, excerpt, body, cover_image, cover_alt, cover_credit_name,
			                      cover_credit_url, cover_unsplash_id, published, featured)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
			[slug, values.title, values.category, values.excerpt, values.body, cover, values.cover_alt, unsplash?.name ?? null, unsplash?.url ?? null, unsplash?.id ?? null]
		);
		return (await getArticle(tx, Number(info.lastInsertRowid)))!;
	});
}

export type UpdateResult = { ok: true; previousCover: string | null } | { ok: false };

/**
 * Perbarui artikel. Slug TIDAK berubah. `cover`: `undefined` = biarkan (termasuk kredit), `null` = hapus sampul,
 * string = path/URL sampul baru; bila `cover` diberikan, kredit Unsplash mengikuti `unsplash` (dikosongkan bila
 * tidak diberikan). `published_at` terisi saat terbit pertama kali dan tidak pernah diubah lagi.
 * Mengembalikan sampul sebelumnya agar pemanggil dapat menghapus berkas unggahannya.
 */
export function updateArticle(
	db: Db,
	id: number,
	values: ArticleValues,
	cover?: string | null,
	unsplash?: UnsplashCover | null
): Promise<UpdateResult> {
	return transaction(db, async (tx): Promise<UpdateResult> => {
		const current = await getArticle(tx, id);
		if (!current) return { ok: false };
		await run(
			tx,
			`UPDATE article SET title = ?, category = ?, excerpt = ?, body = ?, cover_image = ?, cover_alt = ?,
			        cover_credit_name = ?, cover_credit_url = ?, cover_unsplash_id = ?, published = ?, featured = ?, published_at = COALESCE(published_at, CASE WHEN ? = 1 THEN ${NOW} END),
			        updated_at = ${NOW}
			 WHERE id = ?`,
			[
				values.title, values.category, values.excerpt, values.body,
				cover === undefined ? current.cover_image : cover,
				values.cover_alt,
				cover === undefined ? current.cover_credit_name : (unsplash?.name ?? null),
				cover === undefined ? current.cover_credit_url : (unsplash?.url ?? null),
				cover === undefined ? current.cover_unsplash_id : (unsplash?.id ?? null),
				values.published ? 1 : 0, values.featured ? 1 : 0, values.published ? 1 : 0, id
			]
		);
		return { ok: true, previousCover: current.cover_image };
	});
}

export type PublishResult = 'ok' | 'notfound' | 'empty';

/** Terbitkan atau sembunyikan. Artikel tanpa isi tidak dapat diterbitkan. `published_at` hanya diisi sekali. */
export async function setPublished(db: Db, id: number, published: boolean): Promise<PublishResult> {
	return transaction(db, async (tx): Promise<PublishResult> => {
		const current = await getArticle(tx, id);
		if (!current) return 'notfound';
		if (published && current.body.trim() === '') return 'empty';
		await run(
			tx,
			`UPDATE article SET published = ?, published_at = COALESCE(published_at, CASE WHEN ? = 1 THEN ${NOW} END),
			        updated_at = ${NOW} WHERE id = ?`,
			[published ? 1 : 0, published ? 1 : 0, id]
		);
		return 'ok';
	});
}

export async function setFeatured(db: Queryable, id: number, featured: boolean): Promise<boolean> {
	const info = await run(db, `UPDATE article SET featured = ?, updated_at = ${NOW} WHERE id = ?`, [featured ? 1 : 0, id]);
	return info.rowsAffected > 0;
}

export type DeleteResult = { ok: true; cover: string | null } | { ok: false };

/** Hapus artikel; mengembalikan path sampulnya agar berkas unggahan dapat dihapus. */
export function deleteArticle(db: Db, id: number): Promise<DeleteResult> {
	return transaction(db, async (tx): Promise<DeleteResult> => {
		const current = await getArticle(tx, id);
		if (!current) return { ok: false };
		await run(tx, 'DELETE FROM article WHERE id = ?', [id]);
		return { ok: true, cover: current.cover_image };
	});
}
