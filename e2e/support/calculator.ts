import type { Page } from '@playwright/test';

/** Locator bantu untuk section #konsultasi dan slider paket. */
export function calc(page: Page) {
	const root = page.locator('#konsultasi');
	const paket = page.locator('#paket');
	return {
		root,
		team: root.getByLabel('Nama PIC / Perusahaan'),
		whatsapp: root.getByLabel(/Nomor WhatsApp/),
		pax: root.getByLabel('Jumlah peserta'),
		date: root.getByLabel(/Tanggal rencana/),
		notes: root.getByLabel(/Catatan/),
		box: (name: string) => root.getByRole('group', { name: /^Pilih paket/ }).getByRole('checkbox', { name: new RegExp(`^${name}`) }),
		packageBoxes: root.getByRole('group', { name: /^Pilih paket/ }).getByRole('checkbox'),
		addon: (name: string | RegExp) => root.getByRole('group', { name: /^Tambahan/ }).getByRole('checkbox', { name }),
		summary: root.locator('[aria-live="polite"][aria-atomic="true"]'),
		send: root.getByRole('button', { name: /Booking via WhatsApp/ }),
		hint: root.locator('p[id$="-hint"]'),
		status: root.locator('[role=status]'),
		show: (name: string) => paket.getByRole('tab', { name, exact: true }).click(),
		panelToggle: paket.locator('[aria-roledescription="slide"]:not([inert])').getByRole('button', { name: /dari trip$|ke trip$/ })
	};
}

/** Isi masukan yang valid: tim, paket yang dipilih, dan jumlah peserta. */
export async function fillValid(page: Page, opts: { packages?: string[]; team?: string; pax?: string; whatsapp?: string } = {}) {
	const c = calc(page);
	for (const p of opts.packages ?? ['Offroad']) await c.box(p).check();
	await c.team.fill(opts.team ?? 'Tim Alfa');
	await c.whatsapp.fill(opts.whatsapp ?? '081234567890');
	await c.pax.fill(opts.pax ?? '40');
	return c;
}
