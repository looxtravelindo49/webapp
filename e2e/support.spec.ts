import { insertAdmin, uniqueLogin } from './support/admin';
import { expect, gotoReady, submit, test } from './support/fixtures';

test.describe('[e2e-testing] Galat konsol menggagalkan tes', () => {
  // test.fail(): tes ini lulus HANYA bila fixture konsol memang menggagalkan tes di bawahnya.
  test('galat tak terduga menggagalkan tes', async ({ page }) => {
    test.fail();
    await gotoReady(page, '/');
    await page.evaluate(() => console.error('galat-tak-terduga-x'));
  });

  test('peringatan konsol juga menggagalkan tes', async ({ page }) => {
    test.fail();
    await gotoReady(page, '/');
    await page.evaluate(() => console.warn('peringatan-y'));
  });

  test('pageerror menggagalkan tes', async ({ page }) => {
    test.fail();
    await gotoReady(page, '/');
    const errored = page.waitForEvent('pageerror');
    await page.evaluate(() => setTimeout(() => { throw new Error('pageerror-z'); }, 0));
    await errored;
  });

  test('pola yang diizinkan secara eksplisit tidak menggagalkan tes', async ({ page, allowConsole }) => {
    allowConsole(/galat-yang-diharapkan/);
    await gotoReady(page, '/');
    await page.evaluate(() => console.error('galat-yang-diharapkan 123'));
  });

  test('respons 4xx yang disengaja tidak menggagalkan tes', async ({ page, request }) => {
    await gotoReady(page, '/');
    await page.evaluate(() => fetch('/tidak-ada-halaman-ini'));
    expect((await request.get('/tidak-ada-halaman-ini')).status()).toBe(404);
  });
});

test.describe('[e2e-testing] Helper akun admin', () => {
  test('hash scrypt dari insertAdmin dapat dipakai login lewat UI (format selaras dengan aplikasi)', async ({ page }) => {
    const login = uniqueLogin('helper');
    insertAdmin(login, 'sandi-helper-1');
    await gotoReady(page, '/admin/login');
    await page.getByLabel('Login').fill(login);
    await page.getByLabel('Password').fill('sandi-helper-1');
    await submit(page, () => page.getByRole('button', { name: 'Masuk' }).click());
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('uniqueLogin menghasilkan login valid dan berbeda', async () => {
    const a = uniqueLogin('abc');
    const b = uniqueLogin('abc');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9@._-]{3,64}$/);
  });
});
