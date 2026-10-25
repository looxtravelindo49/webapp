import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[clients] Our Clients di bawah estimasi', () => {
	test('judul, urutan, enam logo di desktop, gerak terus, dan reduced motion diam', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.setViewportSize({ width: 1280, height: 900 });
		await gotoReady(page, '/');
		const section = page.locator('#klien');
		await expect(section.getByRole('heading', { name: 'Our Clients' })).toBeVisible();
		const html = await page.content();
		expect(html.indexOf('id="klien"')).toBeGreaterThan(html.indexOf('id="konsultasi"'));
		expect(html.indexOf('id="ulasan"')).toBeGreaterThan(html.indexOf('id="klien"'));
		await expect(section.locator('.clients-word', { hasText: 'Sanbe Farma' }).first()).toBeVisible();
		await expect(section.locator('.clients-word', { hasText: 'Syamil Quran' }).first()).toBeVisible();

		const marquee = section.locator('.clients-marquee');
		const widths = await marquee.evaluate((el) => {
			const item = el.querySelector('.clients-item') as HTMLElement;
			return { item: item.offsetWidth, band: el.clientWidth };
		});
		expect(widths.item).toBeGreaterThan(widths.band / 6 - 2);
		expect(widths.item).toBeLessThan(widths.band / 6 + 2);

		const motion = await section.locator('.clients-track').evaluate((el) => {
			const style = getComputedStyle(el);
			return { name: style.animationName, count: style.animationIterationCount, state: style.animationPlayState };
		});
		expect(motion.name).toContain('clients-scroll');
		expect(motion.count).toBe('infinite');
		expect(motion.state).toBe('running');
		await marquee.hover();
		await expect
			.poll(() => section.locator('.clients-track').evaluate((el) => getComputedStyle(el).animationPlayState))
			.toBe('running');

		await page.setViewportSize({ width: 390, height: 800 });
		const mobile = await marquee.evaluate((el) => {
			const item = el.querySelector('.clients-item') as HTMLElement;
			return { item: item.offsetWidth, band: el.clientWidth };
		});
		expect(mobile.item).toBeGreaterThan(mobile.band / 2.4 - 2);
		expect(mobile.item).toBeLessThan(mobile.band / 2.4 + 2);

		await page.emulateMedia({ reducedMotion: 'reduce' });
		await gotoReady(page, '/');
		const reduced = await page.locator('#klien .clients-track').evaluate((el) => getComputedStyle(el).animationName);
		expect(reduced).toBe('none');
		await expect(page.locator('#klien .clients-copy').first()).toBeHidden();
	});
});
