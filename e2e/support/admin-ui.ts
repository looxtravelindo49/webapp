import type { Page } from '@playwright/test';
import { gotoReady, submit } from './fixtures';

/** Login lewat UI dan tunggu halaman tujuan berhidrasi. */
export async function adminLogin(page: Page, login: string, password: string) {
	await gotoReady(page, '/admin/login');
	await page.getByLabel('Login').fill(login);
	await page.getByLabel('Password').fill(password);
	await submit(page, () => page.getByRole('button', { name: 'Masuk' }).click());
}

/** Matikan validasi HTML5 agar validasi server (pesan kesalahan) bisa diuji. */
export const noClientValidation = (page: Page) =>
	page.evaluate(() => document.querySelectorAll('form').forEach((f) => (f.noValidate = true)));

export const alerts = async (page: Page) => (await page.getByRole('alert').allInnerTexts()).map((t) => t.trim());
export const path = (page: Page) => new URL(page.url()).pathname;
