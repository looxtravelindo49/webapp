import type { PortfolioValues } from '#lib/portfolio-form.js';
import { all, column, one, run, scalar, transaction, type Db, type Queryable } from './db';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export type PortfolioItem = {
	id: number;
	title: string;
	location: string;
	event_date: string;
	event_type: string;
	caption: string;
	alt: string | null;
	image: string | null;
	sort_order: number;
	updated_at: string;
};

const COLUMNS = 'id, title, location, event_date, event_type, caption, alt, image, sort_order, updated_at';

export function listPortfolio(db: Queryable): Promise<PortfolioItem[]> {
	return all<PortfolioItem>(db, `SELECT ${COLUMNS} FROM portfolio_item ORDER BY sort_order, id`);
}

export function getPortfolio(db: Queryable, id: number): Promise<PortfolioItem | null> {
	return one<PortfolioItem>(db, `SELECT ${COLUMNS} FROM portfolio_item WHERE id = ?`, [id]);
}

export function latestPortfolioUpdate(db: Queryable): Promise<string | null> {
	return scalar<string>(db, 'SELECT MAX(updated_at) FROM portfolio_item');
}

export function createPortfolio(db: Db, values: PortfolioValues, image: string | null): Promise<PortfolioItem> {
	return transaction(db, async (tx) => {
		const order = (await scalar<number>(tx, 'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM portfolio_item')) ?? 1;
		const info = await run(
			tx,
			`INSERT INTO portfolio_item (title, location, event_date, event_type, caption, alt, image, sort_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[values.title, values.location, values.eventDate, values.eventType, values.caption, values.alt, image, order]
		);
		const row = await getPortfolio(tx, Number(info.lastInsertRowid));
		if (!row) throw new Error('Portfolio gagal disimpan.');
		return row;
	});
}

export function updatePortfolio(db: Db, id: number, values: PortfolioValues, image: string | null): Promise<boolean> {
	return transaction(db, async (tx) => {
		const info = await run(
			tx,
			`UPDATE portfolio_item
			 SET title = ?, location = ?, event_date = ?, event_type = ?, caption = ?, alt = ?, image = ?, updated_at = ${NOW}
			 WHERE id = ?`,
			[values.title, values.location, values.eventDate, values.eventType, values.caption, values.alt, image, id]
		);
		return info.rowsAffected > 0;
	});
}

/** Hapus baris dan rapatkan urutan. Mengembalikan path foto bila ada. */
export function deletePortfolio(db: Db, id: number): Promise<{ ok: true; image: string | null } | { ok: false }> {
	return transaction(db, async (tx) => {
		const current = await getPortfolio(tx, id);
		if (!current) return { ok: false };
		await run(tx, 'DELETE FROM portfolio_item WHERE id = ?', [id]);
		const ids = await column<number>(tx, 'SELECT id FROM portfolio_item ORDER BY sort_order, id');
		for (const [k, pid] of ids.entries()) await run(tx, 'UPDATE portfolio_item SET sort_order = ? WHERE id = ?', [k + 1, pid]);
		return { ok: true, image: current.image };
	});
}

export type MoveResult = 'moved' | 'boundary' | 'notfound';

export function movePortfolio(db: Db, id: number, direction: 'up' | 'down'): Promise<MoveResult> {
	return transaction(db, async (tx): Promise<MoveResult> => {
		const ids = await column<number>(tx, 'SELECT id FROM portfolio_item ORDER BY sort_order, id');
		const i = ids.indexOf(id);
		if (i < 0) return 'notfound';
		const j = direction === 'up' ? i - 1 : i + 1;
		if (j < 0 || j >= ids.length) return 'boundary';
		[ids[i], ids[j]] = [ids[j], ids[i]];
		for (const [k, pid] of ids.entries()) await run(tx, 'UPDATE portfolio_item SET sort_order = ? WHERE id = ?', [k + 1, pid]);
		return 'moved';
	});
}
