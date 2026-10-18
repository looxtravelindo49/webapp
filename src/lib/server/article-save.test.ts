import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ArticleValues } from '#lib/article-form.js';
import { COVER_CONFLICT_MESSAGE, CoverError, createArticleWithCover, editArticleWithCover } from './article-save';
import { getArticle } from './articles';
import { openDatabase, run, type Db } from './db';
import type { PhotoInput } from './package-save';
import { FsStore } from './uploads';
import { UnsplashError, type Photo, type Unsplash, type UnsplashErrorKind } from './unsplash';
import { vi } from 'vitest';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const png: PhotoInput = { kind: 'new', bytes: PNG, type: { ext: 'png', mime: 'image/png' } };
const jpg: PhotoInput = { kind: 'new', bytes: JPG, type: { ext: 'jpg', mime: 'image/jpeg' } };
const none: PhotoInput = { kind: 'none' };

let dir: string;
let store: FsStore;
const dbs: Db[] = [];
const fresh = async () => {
	const db = await openDatabase(':memory:');
	dbs.push(db);
	return db;
};
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'article-save-'));
	store = new FsStore(dir);
});
afterEach(() => {
	dbs.splice(0).forEach((d) => d.close());
	rmSync(dir, { recursive: true, force: true });
});
const files = () => (existsSync(dir) ? readdirSync(dir) : []);

const values = (over: Partial<ArticleValues> = {}): ArticleValues => ({
	title: 'Tips', category: 'TIPS', excerpt: 'Ringkas', body: 'Isi', cover_alt: null, published: false, featured: false, ...over
});

describe('createArticleWithCover', () => {
	it('tanpa foto: sampul kosong', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), none);
		expect(a.cover_image).toBeNull();
	});
	it('dengan foto: berkas tersimpan dan path ada di artikel', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), png, store);
		expect(a.cover_image).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
		expect(files()).toHaveLength(1);
	});
	it('database gagal → berkas dibersihkan', async () => {
		const db = await fresh();
		await run(db, 'DROP TABLE article');
		await expect(createArticleWithCover(db, values(), png, store)).rejects.toThrow();
		expect(files()).toHaveLength(0);
	});
});

describe('editArticleWithCover', () => {
	it('foto baru menggantikan yang lama dan berkas lama dihapus', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), png, store);
		const old = files()[0];
		expect(await editArticleWithCover(db, a.id, values(), { photo: jpg, removePhoto: false }, store)).toBe(true);
		const now = (await getArticle(db, a.id))!.cover_image!;
		expect(now).toMatch(/\.jpg$/);
		expect(files()).toHaveLength(1);
		expect(files()).not.toContain(old);
	});
	it('tanpa foto dan tanpa hapus → sampul dibiarkan', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), png, store);
		await editArticleWithCover(db, a.id, values({ title: 'Baru' }), { photo: none, removePhoto: false }, store);
		expect((await getArticle(db, a.id))!.cover_image).toBe(a.cover_image);
		expect(files()).toHaveLength(1);
	});
	it('"Hapus foto" mengosongkan sampul dan menghapus berkas', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), png, store);
		await editArticleWithCover(db, a.id, values(), { photo: none, removePhoto: true }, store);
		expect((await getArticle(db, a.id))!.cover_image).toBeNull();
		expect(files()).toHaveLength(0);
	});
	it('sampul bawaan /media tidak pernah dihapus', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), none);
		await run(db, "UPDATE article SET cover_image = '/media/forest.svg' WHERE id = ?", [a.id]);
		await editArticleWithCover(db, a.id, values(), { photo: png, removePhoto: false }, store);
		expect((await getArticle(db, a.id))!.cover_image).toMatch(/^\/uploads\//);
		expect(files()).toHaveLength(1);
	});
	it('artikel tidak ada → false dan berkas baru dibersihkan', async () => {
		const db = await fresh();
		expect(await editArticleWithCover(db, 999, values(), { photo: png, removePhoto: false }, store)).toBe(false);
		expect(files()).toHaveLength(0);
	});
	it('database gagal → berkas baru dibersihkan, lama utuh', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), png, store);
		await run(db, 'DROP TABLE article');
		await expect(editArticleWithCover(db, a.id, values(), { photo: jpg, removePhoto: false }, store)).rejects.toThrow();
		expect(files()).toHaveLength(1);
	});
});


// ---------------------------------------------------------------------------
// Sampul dari Unsplash (klien palsu: tanpa jaringan)
// ---------------------------------------------------------------------------
const RAW = 'https://images.unsplash.com/photo-1?ixlib=rb-4.1.0&ixid=ABC';
const photoOf = (id: string, over: Partial<Photo> = {}): Photo => ({
	id, raw: `https://images.unsplash.com/photo-${id}?ixid=ID${id}`, name: 'Ana Budi', profile: 'https://unsplash.com/@anabudi',
	downloadLocation: `https://api.unsplash.com/photos/${id}/download`, ...over
});
function fakeUnsplash(over: { getPhoto?: (id: string) => Promise<Photo>; track?: boolean } = {}) {
	const getPhoto = vi.fn(over.getPhoto ?? (async (id: string) => photoOf(id)));
	const trackDownload = vi.fn(async () => over.track ?? true);
	return { client: { enabled: true, appName: 'app', getPhoto, trackDownload, search: vi.fn() } as unknown as Unsplash, getPhoto, trackDownload };
}
const failing = (kind: UnsplashErrorKind) => ({ getPhoto: async () => { throw new UnsplashError(kind); } });
const unsplashCols = (a: { cover_image: string | null; cover_credit_name: string | null; cover_credit_url: string | null; cover_unsplash_id: string | null }) => ({
	image: a.cover_image, name: a.cover_credit_name, url: a.cover_credit_url, id: a.cover_unsplash_id
});

describe('createArticleWithCover dengan foto Unsplash', () => {
	it('menyimpan URL, kredit, dan id dari API (bukan dari form) lalu melapor unduhan sekali', async () => {
		const db = await fresh();
		const { client, getPhoto, trackDownload } = fakeUnsplash();
		const a = await createArticleWithCover(db, values(), none, store, 'abc123', client);
		expect(unsplashCols(a)).toEqual({ image: 'https://images.unsplash.com/photo-abc123?ixid=IDabc123', name: 'Ana Budi', url: 'https://unsplash.com/@anabudi', id: 'abc123' });
		expect(getPhoto).toHaveBeenCalledWith('abc123');
		expect(trackDownload).toHaveBeenCalledTimes(1);
		expect(trackDownload).toHaveBeenCalledWith('https://api.unsplash.com/photos/abc123/download');
		expect(files()).toHaveLength(0);
	});

	it('berkas dan foto Unsplash sekaligus ditolak tanpa menulis apa pun', async () => {
		const db = await fresh();
		const { client, getPhoto, trackDownload } = fakeUnsplash();
		const err = await createArticleWithCover(db, values(), png, store, 'abc123', client).catch((e) => e);
		expect(err).toBeInstanceOf(CoverError);
		expect(err.message).toBe(COVER_CONFLICT_MESSAGE);
		expect(getPhoto).not.toHaveBeenCalled();
		expect(trackDownload).not.toHaveBeenCalled();
		expect(files()).toHaveLength(0);
		expect(await db.execute('SELECT COUNT(*) FROM article').then((r) => r.rows[0][0])).toBe(0);
	});

	it.each([
		['not-found', 'Foto Unsplash tidak ditemukan. Pilih foto lain.'],
		['rate-limited', 'Jatah Unsplash sedang habis. Coba lagi nanti atau unggah foto sendiri.'],
		['unavailable', 'Unsplash tidak dapat dihubungi. Coba lagi nanti atau unggah foto sendiri.']
	] as const)('galat Unsplash %s → CoverError berpesan jelas, tanpa data dan tanpa pelacakan', async (kind, message) => {
		const db = await fresh();
		const { client, trackDownload } = fakeUnsplash(failing(kind));
		const err = await createArticleWithCover(db, values(), none, store, 'abc123', client).catch((e) => e);
		expect(err).toBeInstanceOf(CoverError);
		expect(err.message).toBe(message);
		expect(trackDownload).not.toHaveBeenCalled();
		expect(await db.execute('SELECT COUNT(*) FROM article').then((r) => r.rows[0][0])).toBe(0);
	});

	it('database gagal → tidak ada pelacakan unduhan', async () => {
		const db = await fresh();
		await run(db, 'DROP TABLE article');
		const { client, trackDownload } = fakeUnsplash();
		await expect(createArticleWithCover(db, values(), none, store, 'abc123', client)).rejects.toThrow();
		expect(trackDownload).not.toHaveBeenCalled();
	});

	it('pelacakan gagal tidak membatalkan penyimpanan', async () => {
		const db = await fresh();
		const { client } = fakeUnsplash({ track: false });
		const a = await createArticleWithCover(db, values(), none, store, 'abc123', client);
		expect(a.cover_unsplash_id).toBe('abc123');
	});
});

describe('editArticleWithCover dengan foto Unsplash', () => {
	it('menggantikan sampul unggahan: berkas lama terhapus, kredit tersimpan, unduhan dilaporkan', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), png, store);
		expect(files()).toHaveLength(1);
		const { client, trackDownload } = fakeUnsplash();
		expect(await editArticleWithCover(db, a.id, values(), { photo: none, removePhoto: false, unsplashId: 'abc123' }, store, client)).toBe(true);
		const now = (await getArticle(db, a.id))!;
		expect(unsplashCols(now)).toMatchObject({ image: 'https://images.unsplash.com/photo-abc123?ixid=IDabc123', name: 'Ana Budi', id: 'abc123' });
		expect(files()).toHaveLength(0);
		expect(trackDownload).toHaveBeenCalledTimes(1);
	});

	it('id sama dengan yang tersimpan: tanpa panggilan Unsplash dan data tidak berubah, walau "Hapus foto" tercentang', async () => {
		const db = await fresh();
		const first = fakeUnsplash();
		const a = await createArticleWithCover(db, values(), none, store, 'abc123', first.client);
		const before = unsplashCols((await getArticle(db, a.id))!);
		const { client, getPhoto, trackDownload } = fakeUnsplash();
		await editArticleWithCover(db, a.id, values({ title: 'Judul Baru' }), { photo: none, removePhoto: true, unsplashId: 'abc123' }, store, client);
		expect(getPhoto).not.toHaveBeenCalled();
		expect(trackDownload).not.toHaveBeenCalled();
		const after = (await getArticle(db, a.id))!;
		expect(unsplashCols(after)).toEqual(before);
		expect(after.title).toBe('Judul Baru');
	});

	it('foto Unsplash lain menggantikan yang lama dan kredit ikut berganti', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), none, store, 'abc123', fakeUnsplash().client);
		const { client } = fakeUnsplash({ getPhoto: async (id) => photoOf(id, { name: 'Dedi', profile: null }) });
		await editArticleWithCover(db, a.id, values(), { photo: none, removePhoto: false, unsplashId: 'def456' }, store, client);
		expect(unsplashCols((await getArticle(db, a.id))!)).toMatchObject({ name: 'Dedi', url: null, id: 'def456' });
	});

	it('unggahan menggantikan foto Unsplash: kolom kredit dikosongkan', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), none, store, 'abc123', fakeUnsplash().client);
		await editArticleWithCover(db, a.id, values(), { photo: jpg, removePhoto: false }, store);
		const now = (await getArticle(db, a.id))!;
		expect(now.cover_image).toMatch(/^\/uploads\/.+\.jpg$/);
		expect(unsplashCols(now)).toMatchObject({ name: null, url: null, id: null });
		expect(files()).toHaveLength(1);
	});

	it('"Hapus foto" mengosongkan sampul Unsplash dan kreditnya', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), none, store, 'abc123', fakeUnsplash().client);
		await editArticleWithCover(db, a.id, values(), { photo: none, removePhoto: true }, store);
		expect(unsplashCols((await getArticle(db, a.id))!)).toEqual({ image: null, name: null, url: null, id: null });
	});

	it('tanpa perubahan sampul, kredit Unsplash dibiarkan', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), none, store, 'abc123', fakeUnsplash().client);
		const before = unsplashCols((await getArticle(db, a.id))!);
		await editArticleWithCover(db, a.id, values({ title: 'Ganti' }), { photo: none, removePhoto: false }, store);
		expect(unsplashCols((await getArticle(db, a.id))!)).toEqual(before);
	});

	it('berkas dan foto Unsplash sekaligus ditolak; data dan berkas lama utuh', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), png, store);
		const { client, trackDownload } = fakeUnsplash();
		await expect(editArticleWithCover(db, a.id, values(), { photo: jpg, removePhoto: false, unsplashId: 'abc123' }, store, client)).rejects.toThrow(COVER_CONFLICT_MESSAGE);
		expect(files()).toHaveLength(1);
		expect(trackDownload).not.toHaveBeenCalled();
		expect((await getArticle(db, a.id))!.cover_image).toBe(a.cover_image);
	});

	it('galat Unsplash: data dan sampul lama tidak berubah', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), png, store);
		const { client } = fakeUnsplash(failing('rate-limited'));
		await expect(editArticleWithCover(db, a.id, values({ title: 'Tidak Tersimpan' }), { photo: none, removePhoto: false, unsplashId: 'abc123' }, store, client)).rejects.toBeInstanceOf(CoverError);
		const now = (await getArticle(db, a.id))!;
		expect(now.title).toBe('Tips');
		expect(now.cover_image).toBe(a.cover_image);
		expect(files()).toHaveLength(1);
	});

	it('artikel tidak ada → false tanpa memanggil Unsplash', async () => {
		const db = await fresh();
		const { client, getPhoto } = fakeUnsplash();
		expect(await editArticleWithCover(db, 999, values(), { photo: none, removePhoto: false, unsplashId: 'abc123' }, store, client)).toBe(false);
		expect(getPhoto).not.toHaveBeenCalled();
	});

	it('sampul bawaan /media tidak dihapus saat diganti Unsplash', async () => {
		const db = await fresh();
		const a = await createArticleWithCover(db, values(), none);
		await run(db, "UPDATE article SET cover_image = '/media/forest.svg' WHERE id = ?", [a.id]);
		await editArticleWithCover(db, a.id, values(), { photo: none, removePhoto: false, unsplashId: 'abc123' }, store, fakeUnsplash().client);
		expect((await getArticle(db, a.id))!.cover_unsplash_id).toBe('abc123');
	});
});
