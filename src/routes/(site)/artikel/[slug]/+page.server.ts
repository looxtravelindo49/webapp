import { error } from '@sveltejs/kit';
import { renderMarkdown } from '#lib/markdown.js';
import { getPublishedArticleBySlug } from '#lib/server/articles.js';
import { getDb } from '#lib/server/database.js';
import { listPublishedPackages } from '#lib/server/packages.js';
import { unsplashConfig } from '#lib/server/unsplash.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const db = await getDb();
	const [article, published] = await Promise.all([getPublishedArticleBySlug(db, params.slug), listPublishedPackages(db)]);
	if (!article) error(404, 'Artikel tidak ditemukan.');
	const { body, ...meta } = article;
	// Satu-satunya jalur HTML untuk isi artikel: markdown daftar putih (lihat #lib/markdown.ts).
	// Hanya nama aplikasi (untuk UTM kredit) yang dikirim ke halaman; kunci akses tidak pernah.
	return {
		article: meta,
		html: renderMarkdown(body),
		utmSource: unsplashConfig().appName,
		// Tautan internal ke semua paket terbit; hanya slug dan judul yang dikirim.
		packages: published.map(({ slug, title }) => ({ slug, title }))
	};
};
