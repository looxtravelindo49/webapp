import type { Page } from '@playwright/test';
import { calc } from '../support/calculator';
import { expect, gotoReady, test } from '../support/fixtures';

/**
 * Chunk pustaka PDF dikenali dari ukuran (> 100 KB) dan tanda tangan isinya ("jsPDF"), bukan dari nama
 * berkas: nama chunk ber-hash dan berubah pada setiap build.
 */
function trackPdfChunk(page: Page) {
	const found: string[] = [];
	const pending: Promise<void>[] = [];
	page.on('response', (r) => {
		if (!/\.js(\?|$)/.test(r.url())) return;
		pending.push(
			(async () => {
				const body = await r.body().catch(() => null);
				if (body && body.length > 100_000 && body.toString('latin1').includes('jsPDF')) found.push(r.url());
			})()
		);
	});
	return { found, settle: () => Promise.all(pending) };
}

test.describe('[estimate-sharing] jsPDF dimuat dinamis', () => {
	test('tidak ada di bundel awal; mulai dimuat saat fokus ke #konsultasi, dan hanya sekali', async ({ page }) => {
		const chunk = trackPdfChunk(page);
		await gotoReady(page, '/');
		await chunk.settle();
		expect(chunk.found, 'chunk jsPDF tidak boleh termuat saat muat awal').toEqual([]);

		await calc(page).team.focus();
		await expect.poll(async () => { await chunk.settle(); return chunk.found.length }).toBeGreaterThan(0);
		const count = chunk.found.length;

		await calc(page).date.focus();
		await calc(page).notes.focus();
		await chunk.settle();
		expect(chunk.found.length).toBe(count);
		expect(new Set(chunk.found).size).toBe(count);
	});

	test('pointer yang masuk ke section juga memicu prefetch', async ({ page }) => {
		const chunk = trackPdfChunk(page);
		await gotoReady(page, '/');
		await chunk.settle();
		expect(chunk.found).toEqual([]);
		// hover menggulir elemen ke tampilan lalu menggerakkan mouse ke dalam section
		await calc(page).team.hover();
		await expect.poll(async () => { await chunk.settle(); return chunk.found.length }).toBeGreaterThan(0);
	});
});
