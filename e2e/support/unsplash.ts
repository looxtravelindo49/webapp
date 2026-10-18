import type { Page } from '@playwright/test';
import { UNSPLASH_STUB } from './env';
import { expect } from './fixtures';

export type StubCall = { path: 'search' | 'photo' | 'download'; query?: string; page?: number; id?: string; params?: Record<string, string> };

/** Semua panggilan yang diterima Unsplash tiruan sejak server uji dinyalakan. */
export async function stubCalls(): Promise<StubCall[]> {
	return (await fetch(`${UNSPLASH_STUB}/__calls`)).json();
}
export const countCalls = async (match: (c: StubCall) => boolean) => (await stubCalls()).filter(match).length;
export const photoCalls = (id: string) => countCalls((c) => c.path === 'photo' && c.id === id);
export const downloadCalls = (id: string) => countCalls((c) => c.path === 'download' && c.id === id);
export const searchCalls = (query: string) => countCalls((c) => c.path === 'search' && c.query === query);

/** Kueri unik agar cache pencarian aplikasi (10 menit) tidak mencampuri tes lain. */
export const uniqueQuery = (prefix = 'hutan') => `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const openPicker = async (page: Page) => {
	await page.getByRole('button', { name: 'Cari di Unsplash' }).click();
	await expect(page.locator('dialog[open]')).toHaveCount(1);
	return page.locator('dialog[open]');
};

/** Cari di dialog dan tunggu hasil pertama. */
export async function search(page: Page, query: string) {
	const dialog = page.locator('dialog[open]');
	const box = dialog.getByLabel(/^Kata kunci/);
	await box.fill(query);
	await box.press('Enter');
	return dialog;
}

/** Buka pemilih, cari, dan pilih foto ke-`index`; mengembalikan id foto yang terpilih. */
export async function pickPhoto(page: Page, query = uniqueQuery(), index = 0): Promise<string> {
	await openPicker(page);
	const dialog = await search(page, query);
	const buttons = dialog.getByRole('button', { name: /^Pilih foto/ });
	await expect(buttons.first()).toBeVisible();
	await buttons.nth(index).click();
	await expect(page.locator('dialog[open]')).toHaveCount(0);
	const id = await page.locator('input[name=unsplash_id]').inputValue();
	expect(id).toMatch(/^fotouji\d{2}$/);
	return id;
}
