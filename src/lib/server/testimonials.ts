import type { PublicReview } from '#lib/content/reviews.js';
import { formatReviewDate, type TestimonialValues } from '#lib/testimonial-form.js';
import { all, column, one, run, scalar, transaction, type Db, type Queryable } from './db';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export type Testimonial = {
	id: number;
	reviewer_name: string;
	rating: number;
	body: string;
	review_date: string;
	source_url: string | null;
	sort_order: number;
};

const COLUMNS = 'id, reviewer_name, rating, body, review_date, source_url, sort_order';

export function listTestimonials(db: Queryable): Promise<Testimonial[]> {
	return all<Testimonial>(db, `SELECT ${COLUMNS} FROM testimonial ORDER BY sort_order, id`);
}

export function getTestimonial(db: Queryable, id: number): Promise<Testimonial | null> {
	return one<Testimonial>(db, `SELECT ${COLUMNS} FROM testimonial WHERE id = ?`, [id]);
}

export async function listPublicTestimonials(db: Queryable): Promise<PublicReview[]> {
	const rows = await listTestimonials(db);
	return rows.map((row) => ({
		id: `admin-${row.id}`,
		name: row.reviewer_name,
		rating: row.rating,
		text: row.body,
		date: formatReviewDate(row.review_date),
		url: row.source_url
	}));
}

export function createTestimonial(db: Db, values: TestimonialValues): Promise<Testimonial> {
	return transaction(db, async (tx) => {
		const order = (await scalar<number>(tx, 'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM testimonial')) ?? 1;
		const info = await run(
			tx,
			`INSERT INTO testimonial (reviewer_name, rating, body, review_date, source_url, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[values.name, values.rating, values.body, values.date, values.url, order]
		);
		const row = await getTestimonial(tx, Number(info.lastInsertRowid));
		if (!row) throw new Error('Ulasan gagal disimpan.');
		return row;
	});
}

export async function updateTestimonial(db: Queryable, id: number, values: TestimonialValues): Promise<boolean> {
	const info = await run(
		db,
		`UPDATE testimonial
		 SET reviewer_name = ?, rating = ?, body = ?, review_date = ?, source_url = ?, updated_at = ${NOW}
		 WHERE id = ?`,
		[values.name, values.rating, values.body, values.date, values.url, id]
	);
	return info.rowsAffected > 0;
}

export function deleteTestimonial(db: Db, id: number): Promise<boolean> {
	return transaction(db, async (tx) => {
		const info = await run(tx, 'DELETE FROM testimonial WHERE id = ?', [id]);
		if (info.rowsAffected === 0) return false;
		const ids = await column<number>(tx, 'SELECT id FROM testimonial ORDER BY sort_order, id');
		for (const [k, pid] of ids.entries()) await run(tx, 'UPDATE testimonial SET sort_order = ? WHERE id = ?', [k + 1, pid]);
		return true;
	});
}

export type MoveResult = 'moved' | 'boundary' | 'notfound';

export function moveTestimonial(db: Db, id: number, direction: 'up' | 'down'): Promise<MoveResult> {
	return transaction(db, async (tx): Promise<MoveResult> => {
		const ids = await column<number>(tx, 'SELECT id FROM testimonial ORDER BY sort_order, id');
		const i = ids.indexOf(id);
		if (i < 0) return 'notfound';
		const j = direction === 'up' ? i - 1 : i + 1;
		if (j < 0 || j >= ids.length) return 'boundary';
		[ids[i], ids[j]] = [ids[j], ids[i]];
		for (const [k, pid] of ids.entries()) await run(tx, 'UPDATE testimonial SET sort_order = ? WHERE id = ?', [k + 1, pid]);
		return 'moved';
	});
}
