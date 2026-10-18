import { error } from '@sveltejs/kit';
import { renderMarkdown } from '#lib/markdown.js';
import { getPublishedArticleBySlug } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { unsplashConfig } from '#lib/server/unsplash.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const article = await getPublishedArticleBySlug(await getDb(), params.slug);
	if (!article) error(404, 'Artikel tidak ditemukan.');
	const { body, ...meta } = article;
	// Satu-satunya jalur HTML untuk isi artikel: markdown daftar putih (lihat #lib/markdown.ts).
	// Hanya nama aplikasi (untuk UTM kredit) yang dikirim ke halaman; kunci akses tidak pernah.
	return { article: meta, html: renderMarkdown(body), utmSource: unsplashConfig().appName };
};
