import type { PortfolioPhotoText } from '#lib/portfolio-form.js';
import { all, column, one, run, scalar, transaction, type Db, type Queryable } from './db';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export type PortfolioItem = {
	id: number;
	image: string;
	alt: string;
	caption: string | null;
	sort_order: number;
	updated_at: string;
};

const COLUMNS = 'id, image, alt, caption, sort_order, updated_at';

export function listPortfolio(db: Queryable): Promise<PortfolioItem[]> {
	return all<PortfolioItem>(db, `SELECT ${COLUMNS} FROM portfolio_item ORDER BY sort_order, id`);
}

export function getPortfolio(db: Queryable, id: number): Promise<PortfolioItem | null> {
	return one<PortfolioItem>(db, `SELECT ${COLUMNS} FROM portfolio_item WHERE id = ?`, [id]);
}

export function latestPortfolioUpdate(db: Queryable): Promise<string | null> {
	return scalar<string>(db, 'SELECT MAX(updated_at) FROM portfolio_item');
}

export function addPortfolioPhotos(db: Db, photos: (PortfolioPhotoText & { image: string })[]): Promise<void> {
	return transaction(db, async (tx) => {
		let order = (await scalar<number>(tx, 'SELECT COALESCE(MAX(sort_order), 0) FROM portfolio_item')) ?? 0;
		for (const photo of photos) {
			order += 1;
			await run(tx, 'INSERT INTO portfolio_item (image, alt, caption, sort_order) VALUES (?, ?, ?, ?)', [photo.image, photo.alt, photo.caption, order]);
		}
	});
}

export async function updatePortfolioText(db: Queryable, id: number, alt: string, caption: string | null): Promise<boolean> {
	const info = await run(db, `UPDATE portfolio_item SET alt = ?, caption = ?, updated_at = ${NOW} WHERE id = ?`, [alt, caption, id]);
	return info.rowsAffected > 0;
}

/** Hapus baris dan rapatkan urutan. Mengembalikan path foto bila ada. */
export function deletePortfolio(db: Db, id: number): Promise<{ ok: true; image: string } | { ok: false }> {
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
