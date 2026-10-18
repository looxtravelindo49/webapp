import { afterEach, describe, expect, it } from 'vitest';
import type { ArticleValues } from '#lib/article-form.js';
import {
	createArticle, deleteArticle, getArticle, getPublishedArticleBySlug, listAllArticles, listPopularArticles,
	listPublishedArticles, setFeatured, setPublished, updateArticle
} from './articles';
import { openDatabase, run, scalar, type Db } from './db';
import { seed } from './seed';
import { getSetting } from './settings';

const dbs: Db[] = [];
const fresh = async () => {
	const db = await openDatabase(':memory:'); // tanpa seed: tabel artikel kosong
	dbs.push(db);
	return db;
};
afterEach(() => dbs.splice(0).forEach((d) => d.close()));

const values = (over: Partial<ArticleValues> = {}): ArticleValues => ({
	title: 'Tips Gathering', category: 'PERENCANAAN', excerpt: 'Ringkas.', body: 'Isi artikel.', cover_alt: null,
	published: false, featured: false, ...over
});

/** Buat artikel terbit dengan `published_at` tertentu (untuk menguji urutan). */
async function make(db: Db, title: string, o: { at?: string | null; featured?: boolean; published?: boolean } = {}) {
	const a = await createArticle(db, values({ title }), null);
	const published = o.published ?? true;
	await run(db, 'UPDATE article SET published = ?, featured = ?, published_at = ? WHERE id = ?', [
		published ? 1 : 0, o.featured ? 1 : 0, published ? (o.at ?? '2026-01-01T00:00:00.000Z') : null, a.id
	]);
	return a;
}
const titles = (list: { title: string }[]) => list.map((a) => a.title);

describe('createArticle / slug', () => {
	it('artikel baru berupa draf, tidak unggulan, tanpa published_at', async () => {
		const a = await createArticle(await fresh(), values(), null);
		expect(a).toMatchObject({ slug: 'tips-gathering', published: 0, featured: 0, published_at: null, cover_image: null });
	});
	it('slug dari judul dengan karakter khusus', async () => {
		expect((await createArticle(await fresh(), values({ title: 'Café & Ñandú 100%!' }), null)).slug).toBe('cafe-nandu-100');
	});
	it('slug bentrok mendapat sufiks -2, -3', async () => {
		const db = await fresh();
		expect((await createArticle(db, values(), null)).slug).toBe('tips-gathering');
		expect((await createArticle(db, values(), null)).slug).toBe('tips-gathering-2');
		expect((await createArticle(db, values(), null)).slug).toBe('tips-gathering-3');
	});
	it('judul tanpa karakter valid → artikel, artikel-2', async () => {
		const db = await fresh();
		expect((await createArticle(db, values({ title: '🎉🎉' }), null)).slug).toBe('artikel');
		expect((await createArticle(db, values({ title: '🎊' }), null)).slug).toBe('artikel-2');
	});
	it('menyimpan path sampul', async () => {
		const a = await createArticle(await fresh(), values({ cover_alt: 'alt' }), '/uploads/x.png');
		expect(a).toMatchObject({ cover_image: '/uploads/x.png', cover_alt: 'alt' });
	});
});

describe('updateArticle', () => {
	it('slug tetap saat judul berubah', async () => {
		const db = await fresh();
		const a = await createArticle(db, values(), null);
		await updateArticle(db, a.id, values({ title: 'Panduan Gathering' }));
		expect(await getArticle(db, a.id)).toMatchObject({ slug: 'tips-gathering', title: 'Panduan Gathering' });
	});
	it('sampul: undefined = biarkan, null = hapus, string = ganti', async () => {
		const db = await fresh();
		const a = await createArticle(db, values(), '/uploads/a.png');
		expect(await updateArticle(db, a.id, values())).toEqual({ ok: true, previousCover: '/uploads/a.png' });
		expect((await getArticle(db, a.id))!.cover_image).toBe('/uploads/a.png');
		await updateArticle(db, a.id, values(), '/uploads/b.png');
		expect((await getArticle(db, a.id))!.cover_image).toBe('/uploads/b.png');
		await updateArticle(db, a.id, values(), null);
		expect((await getArticle(db, a.id))!.cover_image).toBeNull();
	});
	it('id tidak ada → ok:false', async () => {
		expect(await updateArticle(await fresh(), 999, values())).toEqual({ ok: false });
	});
});

describe('published_at', () => {
	it('diisi saat terbit pertama dan tidak berubah saat sembunyi lalu terbit lagi', async () => {
		const db = await fresh();
		const a = await createArticle(db, values(), null);
		expect(await setPublished(db, a.id, true)).toBe('ok');
		const first = (await getArticle(db, a.id))!.published_at;
		expect(first).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		await run(db, "UPDATE article SET published_at = '2020-05-05T00:00:00.000Z' WHERE id = ?", [a.id]);
		await setPublished(db, a.id, false);
		await setPublished(db, a.id, true);
		expect((await getArticle(db, a.id))!.published_at).toBe('2020-05-05T00:00:00.000Z');
	});
	it('draf yang disimpan berkali-kali tetap tanpa published_at', async () => {
		const db = await fresh();
		const a = await createArticle(db, values(), null);
		await updateArticle(db, a.id, values({ title: 'Baru' }));
		await updateArticle(db, a.id, values({ title: 'Baru lagi' }));
		expect((await getArticle(db, a.id))!.published_at).toBeNull();
	});
	it('updateArticle dengan published=true mengisi published_at sekali', async () => {
		const db = await fresh();
		const a = await createArticle(db, values(), null);
		await updateArticle(db, a.id, values({ published: true }));
		const at = (await getArticle(db, a.id))!.published_at;
		expect(at).not.toBeNull();
		await updateArticle(db, a.id, values({ published: false }));
		await updateArticle(db, a.id, values({ published: true }));
		expect((await getArticle(db, a.id))!.published_at).toBe(at);
	});
	it('tidak dapat menerbitkan artikel tanpa isi', async () => {
		const db = await fresh();
		const a = await createArticle(db, values({ body: '' }), null);
		expect(await setPublished(db, a.id, true)).toBe('empty');
		expect((await getArticle(db, a.id))!.published).toBe(0);
		expect(await setPublished(db, 999, true)).toBe('notfound');
	});
});

describe('daftar publik', () => {
	it('hanya terbit, terbaru dulu; slug draf tidak ditemukan', async () => {
		const db = await fresh();
		await make(db, 'Lama', { at: '2026-01-01T00:00:00.000Z' });
		await make(db, 'Baru', { at: '2026-03-01T00:00:00.000Z' });
		const draft = await make(db, 'Draf', { published: false });
		expect(titles(await listPublishedArticles(db))).toEqual(['Baru', 'Lama']);
		expect(await getPublishedArticleBySlug(db, draft.slug)).toBeNull();
		expect(await getPublishedArticleBySlug(db, 'baru')).toMatchObject({ title: 'Baru', body: 'Isi artikel.' });
		expect(await getPublishedArticleBySlug(db, 'tidak-ada')).toBeNull();
	});
	it('ringkasan tidak memuat isi', async () => {
		const db = await fresh();
		await make(db, 'A');
		expect('body' in (await listPublishedArticles(db))[0]).toBe(false);
		expect('body' in (await listPopularArticles(db))[0]).toBe(false);
	});
	it('daftar admin memuat draf juga', async () => {
		const db = await fresh();
		await make(db, 'A');
		await make(db, 'B', { published: false });
		expect(await listAllArticles(db)).toHaveLength(2);
	});
});

describe('artikel populer', () => {
	it('tiga unggulan dari lima terbit → ketiganya, terbaru dulu', async () => {
		const db = await fresh();
		await make(db, 'u1', { featured: true, at: '2026-01-01T00:00:00.000Z' });
		await make(db, 'u2', { featured: true, at: '2026-02-01T00:00:00.000Z' });
		await make(db, 'u3', { featured: true, at: '2026-03-01T00:00:00.000Z' });
		await make(db, 'n1', { at: '2026-09-01T00:00:00.000Z' });
		await make(db, 'n2', { at: '2026-10-01T00:00:00.000Z' });
		expect(titles(await listPopularArticles(db))).toEqual(['u3', 'u2', 'u1']);
	});
	it('satu unggulan → diikuti dua artikel terbit terbaru yang bukan unggulan', async () => {
		const db = await fresh();
		await make(db, 'u1', { featured: true, at: '2026-01-01T00:00:00.000Z' });
		await make(db, 'n1', { at: '2026-02-01T00:00:00.000Z' });
		await make(db, 'n2', { at: '2026-03-01T00:00:00.000Z' });
		await make(db, 'n3', { at: '2026-04-01T00:00:00.000Z' });
		expect(titles(await listPopularArticles(db))).toEqual(['u1', 'n3', 'n2']);
	});
	it('lima unggulan → hanya tiga terbaru', async () => {
		const db = await fresh();
		for (let i = 1; i <= 5; i++) await make(db, `u${i}`, { featured: true, at: `2026-0${i}-01T00:00:00.000Z` });
		expect(titles(await listPopularArticles(db))).toEqual(['u5', 'u4', 'u3']);
	});
	it('draf unggulan diabaikan', async () => {
		const db = await fresh();
		await make(db, 'draf', { featured: true, published: false });
		await make(db, 'a');
		expect(titles(await listPopularArticles(db))).toEqual(['a']);
	});
	it('kurang dari tiga terbit → seadanya; kosong → kosong', async () => {
		const db = await fresh();
		expect(await listPopularArticles(db)).toEqual([]);
		await make(db, 'a');
		await make(db, 'b');
		expect(await listPopularArticles(db)).toHaveLength(2);
	});
	it('setFeatured menandai dan melepas', async () => {
		const db = await fresh();
		const a = await make(db, 'a', { at: '2026-01-01T00:00:00.000Z' });
		await make(db, 'b', { at: '2026-02-01T00:00:00.000Z' });
		await make(db, 'c', { at: '2026-03-01T00:00:00.000Z' });
		await make(db, 'd', { at: '2026-04-01T00:00:00.000Z' });
		expect(titles(await listPopularArticles(db))).toEqual(['d', 'c', 'b']);
		expect(await setFeatured(db, a.id, true)).toBe(true);
		expect(titles(await listPopularArticles(db))).toEqual(['a', 'd', 'c']);
		await setFeatured(db, a.id, false);
		expect(titles(await listPopularArticles(db))).toEqual(['d', 'c', 'b']);
		expect(await setFeatured(db, 999, true)).toBe(false);
	});
});

describe('id tidak valid dan hapus', () => {
	it.each([NaN, Infinity, 1.5])('getArticle(%s) → null', async (id) => {
		expect(await getArticle(await fresh(), id)).toBeNull();
	});
	it('hapus mengembalikan sampul; id tidak ada → ok:false', async () => {
		const db = await fresh();
		const a = await createArticle(db, values(), '/uploads/a.png');
		expect(await deleteArticle(db, a.id)).toEqual({ ok: true, cover: '/uploads/a.png' });
		expect(await scalar(db, 'SELECT COUNT(*) FROM article')).toBe(0);
		expect(await deleteArticle(db, a.id)).toEqual({ ok: false });
	});
});

describe('seed artikel bawaan', () => {
	it('start pertama: tiga artikel terbit dan unggulan; urutan populer sama dengan beranda lama', async () => {
		const db = await fresh();
		await seed(db);
		const all = await listAllArticles(db);
		expect(all).toHaveLength(3);
		expect(all.every((a) => a.published === 1 && a.featured === 1 && a.published_at)).toBe(true);
		expect((await listPopularArticles(db)).map((a) => a.category)).toEqual(['PERENCANAAN', 'PILIH KEGIATAN', 'TIPS PANITIA']);
		expect(await getSetting(db, 'seeded_articles')).toBe('1');
	});
	it('dijalankan dua kali tidak menggandakan', async () => {
		const db = await fresh();
		await seed(db);
		await seed(db);
		expect(await listAllArticles(db)).toHaveLength(3);
	});
	it('tidak muncul lagi setelah admin menghapus semuanya', async () => {
		const db = await fresh();
		await seed(db);
		for (const a of await listAllArticles(db)) await deleteArticle(db, a.id);
		await seed(db);
		expect(await listAllArticles(db)).toEqual([]);
	});
	it('tidak menyentuh artikel buatan admin', async () => {
		const db = await fresh();
		await createArticle(db, values({ title: 'Punya Admin' }), null);
		await seed(db);
		expect(await listAllArticles(db)).toHaveLength(4);
	});
	it('dua seed bersamaan menghasilkan tepat tiga artikel', async () => {
		const db = await fresh();
		await Promise.allSettled([seed(db), seed(db)]);
		expect(await listAllArticles(db)).toHaveLength(3);
	});
});

describe('migrasi 0005 (kolom kredit Unsplash)', () => {
	it('mempertahankan artikel yang ada dan menambah kolom kredit yang kosong', async () => {
		const { migrate, migrations } = await import('./db');
		const before = migrations.filter((m) => m.version < '0005');
		const db = await openDatabase(':memory:', before);
		dbs.push(db);
		await run(db, "INSERT INTO article (slug, title, category, excerpt, body, cover_image) VALUES ('lama', 'Lama', 'X', 'e', 'b', '/uploads/a.png')");
		await migrate(db, migrations);
		const a = await getArticle(db, 1);
		expect(a).toMatchObject({ slug: 'lama', cover_image: '/uploads/a.png', cover_credit_name: null, cover_credit_url: null, cover_unsplash_id: null });
	});
});
