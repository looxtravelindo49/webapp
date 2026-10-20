import { expect, gotoReady, test } from '../support/fixtures';

test.describe('[katalog] Katalog paket dan halaman detail', () => {
	test('tiga kartu dulu, sisanya terbuka tanpa pindah halaman', async ({ page }) => {
		await gotoReady(page, '/');
		const ids = await page.$$eval('main > section[id]', (s) => s.map((x) => x.id));
		expect(ids.indexOf('katalog')).toBeGreaterThanOrEqual(0);
		expect(ids.indexOf('katalog')).toBeLessThan(ids.indexOf('paket'));
		const katalog = page.locator('#katalog');
		await expect(katalog.getByRole('heading', { level: 2 })).toHaveText('Katalog paket');
		await expect(katalog.getByRole('link', { name: 'Add Offroad' })).toBeVisible();
		await expect(katalog.getByRole('link', { name: 'Add Team Building' })).toBeVisible();
		await expect(katalog.getByRole('link', { name: 'Add Rafting' })).toBeVisible();
		await expect(katalog.getByText('2-3 Jam')).toBeVisible();
		await expect(katalog.getByText('Rp250rb/orang')).toBeVisible();
		await expect(katalog.getByText('by Loox Travel').first()).toBeVisible();
		await expect(katalog.getByText('Lembang').first()).toBeVisible();
		await expect(katalog.getByRole('link', { name: 'Add Paintball' })).toBeHidden();
		await expect(katalog.getByRole('link', { name: 'Add Fun Games' })).toBeHidden();
		await katalog.getByText('Lihat semua paket').click();
		await expect(katalog.getByRole('link', { name: 'Add Paintball' })).toBeVisible();
		await expect(katalog.getByRole('link', { name: 'Add Fun Games' })).toBeVisible();
		await expect(page).toHaveURL(/\/$/);
	});

	test('detail paket memakai data database dan menambahkannya ke kalkulator', async ({ page }) => {
		await gotoReady(page, '/');
		await page.locator('#katalog').getByRole('link', { name: 'Add Offroad' }).click();
		await expect(page).toHaveURL(/\/paket\/offroad$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Offroad');
		await expect(page.getByText('2-3 Jam')).toBeVisible();
		await expect(page.getByText('Rp 250.000 / orang')).toBeVisible();
		await expect(page.getByText('Min. 1 orang')).toBeVisible();
		await expect(page).toHaveTitle(/Offroad \| Lembang Adventure/);
		const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
		expect(canonical).toMatch(/\/paket\/offroad$/);

		await page.getByRole('link', { name: 'Tambah ke Trip' }).click();
		await expect(page).toHaveURL(/\/\?paket=offroad#konsultasi$/);
		await expect(page.getByRole('checkbox', { name: /Offroad/ })).toBeChecked();
		await expect(page.getByRole('checkbox', { name: /Rafting/ })).not.toBeChecked();
	});

	test('slug yang tidak ada mengembalikan 404', async ({ page }) => {
		const res = await page.goto('/paket/tidak-ada');
		expect(res?.status()).toBe(404);
	});
});
