import type { Page } from '@playwright/test';
import { calc } from '../support/calculator';
import { expect, gotoReady, test } from '../support/fixtures';

/** Chunk jsPDF dikenali dari ukuran dan tanda tangan isinya, bukan nama berkas. */
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

test.describe('[estimate-sharing] jsPDF tidak dimuat', () => {
	test('beranda dan interaksi kalkulator tidak mengunduh jsPDF', async ({ page }) => {
		const chunk = trackPdfChunk(page);
		await gotoReady(page, '/');
		await calc(page).team.focus();
		await calc(page).team.hover();
		await calc(page).notes.focus();
		await chunk.settle();
		expect(chunk.found, 'alur invoice tidak memakai jsPDF').toEqual([]);
	});
});
