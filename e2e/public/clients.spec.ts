import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[clients] Our Clients di bawah estimasi', () => {
	test('desktop enam logo satu baris, ponsel dua baris tiga logo, gerak terus', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.setViewportSize({ width: 1280, height: 900 });
		await gotoReady(page, '/');
		const section = page.locator('#klien');
		await expect(section.getByRole('heading', { name: 'Our Clients' })).toBeVisible();
		const html = await page.content();
		expect(html.indexOf('id="klien"')).toBeGreaterThan(html.indexOf('id="konsultasi"'));
		expect(html.indexOf('id="ulasan"')).toBeGreaterThan(html.indexOf('id="klien"'));
		await expect(section.locator('.clients-desktop')).toBeVisible();
		await expect(section.locator('.clients-mobile')).toBeHidden();

		const desktop = section.locator('.clients-desktop .clients-marquee');
		const widths = await desktop.evaluate((el) => {
			const item = el.querySelector('.clients-item') as HTMLElement;
			return { item: item.offsetWidth, band: el.clientWidth };
		});
		expect(widths.item).toBeGreaterThan(widths.band / 6 - 2);
		expect(widths.item).toBeLessThan(widths.band / 6 + 2);

		const motion = await section.locator('.clients-desktop .clients-track').evaluate((el) => {
			const style = getComputedStyle(el);
			return { name: style.animationName, count: style.animationIterationCount, state: style.animationPlayState };
		});
		expect(motion.name).toContain('clients-scroll');
		expect(motion.count).toBe('infinite');
		expect(motion.state).toBe('running');
		await desktop.hover();
		await expect
			.poll(() => section.locator('.clients-desktop .clients-track').evaluate((el) => getComputedStyle(el).animationPlayState))
			.toBe('running');

		await page.setViewportSize({ width: 390, height: 800 });
		await expect(section.locator('.clients-desktop')).toBeHidden();
		const rows = section.locator('.clients-mobile .clients-marquee');
		await expect(rows).toHaveCount(2);
		const mobile = await rows.evaluateAll((els) =>
			els.map((el) => {
				const item = el.querySelector('.clients-item') as HTMLElement;
				const style = getComputedStyle(el.querySelector('.clients-track') as HTMLElement);
				return {
					item: item.offsetWidth,
					band: el.clientWidth,
					name: style.animationName,
					count: style.animationIterationCount,
					state: style.animationPlayState,
					text: el.textContent ?? ''
				};
			})
		);
		expect(mobile).toHaveLength(2);
		for (const row of mobile) {
			expect(row.item).toBeGreaterThan(row.band / 3 - 2);
			expect(row.item).toBeLessThan(row.band / 3 + 2);
			expect(row.name).toContain('clients-scroll');
			expect(row.count).toBe('infinite');
			expect(row.state).toBe('running');
		}
		expect(mobile[0].text).toContain('Sanbe Farma');
		expect(mobile[1].text).toContain('Syamil Quran');
		const mobileHtml = await section.locator('.clients-mobile').innerHTML();
		for (const src of [
			'/media/clients/mandiri.svg',
			'/media/clients/bni.svg',
			'/media/clients/bsi.svg',
			'/media/clients/telkom.svg',
			'/media/clients/pertamina.svg',
			'/media/clients/pgn.svg',
			'/media/clients/heavenly-blush.png',
			'/media/clients/daarut-tauhid.png',
			'/media/clients/pln.svg'
		]) {
			expect(mobileHtml, src).toContain(src);
		}
		expect(mobileHtml).toContain('Sanbe Farma');
		expect(mobileHtml).toContain('Syamil Quran');

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await gotoReady(page, '/');
		const reduced = await page.locator('#klien .clients-mobile .clients-track').evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
		expect(reduced).toEqual(['none', 'none']);
		await expect(page.locator('#klien .clients-mobile .clients-copy').first()).toBeHidden();
	});
});