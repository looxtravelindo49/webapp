import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { UPLOAD_DIR, uniqueTitle } from './cms';
import { exec, query, scalar } from './db';

export { uniqueTitle };

export type ArticleRow = {
	id: number;
	slug: string;
	title: string;
	category: string;
	excerpt: string;
	body: string;
	cover_image: string | null;
	cover_alt: string | null;
	published: number;
	featured: number;
	published_at: string | null;
	updated_at: string;
};
export const articleByTitle = (title: string) => query<ArticleRow>('SELECT * FROM article WHERE title = ?', title)[0];
export const articleById = (id: number) => query<ArticleRow>('SELECT * FROM article WHERE id = ?', id)[0];
export const slugOf = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Sisipkan artikel langsung ke database (tanpa UI). Bawaan: draf, tanpa tanda populer. */
export function insertArticle(
	title: string,
	over: Partial<Pick<ArticleRow, 'category' | 'excerpt' | 'body' | 'cover_image' | 'published' | 'featured' | 'published_at'>> = {}
): ArticleRow {
	const published = over.published ?? 0;
	exec(
		`INSERT INTO article (slug, title, category, excerpt, body, cover_image, published, featured, published_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		slugOf(title), title, over.category ?? 'TES', over.excerpt ?? 'Ringkasan uji.', over.body ?? 'Isi uji.',
		over.cover_image ?? null, published, over.featured ?? 0,
		over.published_at ?? (published ? new Date().toISOString() : null)
	);
	return articleByTitle(title)!;
}

/** Hapus artikel uji berawalan `prefix` beserta berkas sampul unggahannya. */
export function cleanupArticles(prefix: string): void {
	for (const a of query<ArticleRow>('SELECT * FROM article WHERE title LIKE ?', `${prefix}%`)) {
		if (a.cover_image?.startsWith('/uploads/')) rmSync(join(UPLOAD_DIR, a.cover_image.slice('/uploads/'.length)), { force: true });
		exec('DELETE FROM article WHERE id = ?', a.id);
	}
}

export const articleCount = () => scalar<number>('SELECT COUNT(*) FROM article');

export type ArticleFormValues = Partial<{ title: string; category: string; excerpt: string; body: string; cover_alt: string }>;

const LABELS: Record<keyof ArticleFormValues, string | RegExp> = {
	title: 'Judul',
	category: 'Kategori',
	excerpt: 'Ringkasan',
	body: 'Isi artikel',
	cover_alt: /^Teks alternatif foto/
};

/** Isi isian form artikel yang disebut saja. */
export async function fillArticle(page: Page, values: ArticleFormValues) {
	for (const [key, value] of Object.entries(values) as [keyof ArticleFormValues, string][]) {
		await page.getByLabel(LABELS[key], { exact: typeof LABELS[key] === 'string' }).fill(value);
	}
}
