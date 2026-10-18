import type { Page } from '@playwright/test';

/** Locator bantu untuk section #konsultasi dan tab Paket. */
export function calc(page: Page) {
	const root = page.locator('#konsultasi');
	return {
		root,
		team: root.getByLabel('Nama tim / perusahaan'),
		whatsapp: root.getByLabel(/Nomor WhatsApp/),
		pax: root.getByLabel('Jumlah peserta'),
		date: root.getByLabel(/Tanggal rencana/),
		notes: root.getByLabel(/Catatan/),
		box: (name: string) => root.getByRole('checkbox', { name: new RegExp(`^${name}`) }),
		summary: root.locator('[aria-live="polite"][aria-atomic="true"]'),
		save: root.getByRole('button', { name: 'Simpan PDF' }),
		send: root.getByRole('button', { name: /Kirim ke WhatsApp/ }),
		hint: root.locator('p[id$="-hint"]'),
		status: root.locator('[role=status]'),
		tab: (name: string) => page.getByRole('tab', { name: new RegExp(`^${name}`) }),
		panelToggle: page.locator('[role=tabpanel]:not([hidden])').getByRole('button', { name: /dari trip$|ke trip$/ })
	};
}

/** Isi masukan yang valid: tim, paket yang dipilih, dan jumlah peserta. */
export async function fillValid(page: Page, opts: { packages?: string[]; team?: string; pax?: string } = {}) {
	const c = calc(page);
	for (const p of opts.packages ?? ['Offroad']) await c.box(p).check();
	await c.team.fill(opts.team ?? 'Tim Alfa');
	await c.pax.fill(opts.pax ?? '40');
	return c;
}
