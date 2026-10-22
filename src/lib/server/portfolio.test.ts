import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type Db } from './db';
import { addPortfolioPhotos, deletePortfolio, listPortfolio, movePortfolio, updatePortfolioText } from './portfolio';
import { chooseReviews, loadPublicReviews } from './public-reviews';
import { seed } from './seed';
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

describe('seed portfolio', () => {
	it('tidak mengisi foto atau ulasan', async () => {
		const db = await fresh();
		await seed(db);
		expect(await listPortfolio(db)).toEqual([]);
		expect(await listPublicTestimonials(db)).toEqual([]);
		expect(await loadPublicReviews(db, {})).toEqual([]);
	});
});

describe('portfolio dan ulasan', () => {
	it('menyimpan foto, mengurutkan, dan tidak memakai data klien', async () => {
		const db = await fresh();
		await addPortfolioPhotos(db, [
			{ image: '/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c.webp', alt: 'Hutan', caption: null },
			{ image: '/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7d.webp', alt: 'Sungai', caption: 'Arus tenang' }
		]);
		const items = await listPortfolio(db);
		expect(items.map((item) => item.alt)).toEqual(['Hutan', 'Sungai']);
		expect(items[0]).not.toHaveProperty('title');
		expect(await movePortfolio(db, items[0].id, 'down')).toBe('moved');
		expect((await listPortfolio(db)).map((item) => item.alt)).toEqual(['Sungai', 'Hutan']);
		expect(await updatePortfolioText(db, items[1].id, 'Sungai jernih', null)).toBe(true);
		expect((await deletePortfolio(db, items[0].id)).ok).toBe(true);
		expect(await listPortfolio(db)).toHaveLength(1);

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
