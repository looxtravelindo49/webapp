import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, scalar, type Db } from './db';
import { createPortfolio, deletePortfolio, listPortfolio, movePortfolio } from './portfolio';
import { chooseReviews, loadPublicReviews } from './public-reviews';
import { seed, seedPortfolioItem } from './seed';
import { createTestimonial, listPublicTestimonials } from './testimonials';

const dirs: string[] = [];
const dbs: Db[] = [];

async function fresh() {
	const dir = mkdtempSync(join(tmpdir(), 'portfolio-'));
	dirs.push(dir);
	const db = await openDatabase(join(dir, 'app.db'));
	dbs.push(db);
	return db;
}

afterEach(() => {
	for (const db of dbs.splice(0)) db.close();
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const values = {
	title: 'Outing',
	location: 'Lembang',
	eventDate: '1 Mei 2026',
	eventType: 'Outing',
	caption: '10 peserta',
	alt: null,
	removePhoto: false
};

describe('seed portfolio', () => {
	it('mengisi satu dokumentasi nyata tanpa foto dan tanpa ulasan', async () => {
		const db = await fresh();
		await seed(db);
		const items = await listPortfolio(db);
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			title: seedPortfolioItem.title,
			location: seedPortfolioItem.location,
			event_date: seedPortfolioItem.eventDate,
			event_type: seedPortfolioItem.eventType,
			caption: seedPortfolioItem.caption,
			alt: null,
			image: null
		});
		expect(await listPublicTestimonials(db)).toEqual([]);
		expect(await loadPublicReviews(db, {})).toEqual([]);
		await seed(db);
		expect(await listPortfolio(db)).toHaveLength(1);
	});

	it('tidak mengembalikan item setelah dihapus', async () => {
		const db = await fresh();
		await seed(db);
		const [item] = await listPortfolio(db);
		expect((await deletePortfolio(db, item.id)).ok).toBe(true);
		await seed(db);
		expect(await listPortfolio(db)).toEqual([]);
		expect(await scalar(db, "SELECT value FROM setting WHERE key = 'seeded_portfolio'")).toBe('1');
	});
});

describe('portfolio dan ulasan', () => {
	it('mengurutkan dokumentasi dan menyimpan ulasan admin', async () => {
		const db = await fresh();
		const a = await createPortfolio(db, { ...values, title: 'A' }, null);
		const b = await createPortfolio(db, { ...values, title: 'B' }, null);
		expect(await movePortfolio(db, a.id, 'up')).toBe('boundary');
		expect(await movePortfolio(db, a.id, 'down')).toBe('moved');
		expect((await listPortfolio(db)).map((item) => item.title)).toEqual(['B', 'A']);
		expect(b.sort_order).toBe(2);

		const review = await createTestimonial(db, { name: 'Rina', rating: 5, body: 'Nyaman.', date: '2026-08-02', url: null });
		const admin = await loadPublicReviews(db, {});
		expect(admin).toEqual([
			{ id: `admin-${review.id}`, name: 'Rina', rating: 5, text: 'Nyaman.', date: expect.stringMatching(/2026/), url: null }
		]);
		const google = [{ id: 'google-1', name: 'Google', rating: 4, text: 'Asli.', date: '1 Jan 2026', url: null }];
		expect(chooseReviews(google, admin)).toEqual(google);
		expect(chooseReviews([], admin)).toEqual(admin);
		expect(chooseReviews(null, admin)).toEqual(admin);
	});
});
