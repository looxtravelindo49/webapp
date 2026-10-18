import { describe, expect, it } from 'vitest';
import { buildEstimatePdf } from './pdf';
import { calculateEstimate } from './pricing';
import type { Package } from './types';

const pkg = (slug: string, title: string, price: number | null, min_pax = 1): Package => ({
	id: 1, slug, title, summary: '', body: '', includes: '', notes: '', image: null, image_alt: null,
	duration: null, price_per_person: price, min_pax, published: 1, sort_order: 1
});
const packages = [
	pkg('offroad', 'Offroad', 250000),
	pkg('rafting', 'Rafting', 200000, 10),
	pkg('fun-games', 'Fun Games', null)
];

async function render(slugs: string[], pax: number, extra: { team?: string; notes?: string; planDate?: string } = {}) {
	const blob = await buildEstimatePdf({
		team: extra.team ?? 'Tim Alfa',
		pax,
		estimate: calculateEstimate(packages, slugs, pax),
		planDate: extra.planDate ?? '',
		notes: extra.notes ?? '',
		createdAt: new Date(2026, 9, 17)
	});
	const bytes = Buffer.from(await blob.arrayBuffer());
	return { blob, raw: bytes.toString('latin1') };
}

const pageCount = (raw: string) => (raw.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;

describe('buildEstimatePdf', () => {
	it('muat dalam satu halaman untuk estimasi biasa, dengan pernyataan di halaman yang sama', async () => {
		const { raw } = await render(['offroad', 'rafting', 'fun-games'], 4, { notes: 'Catatan singkat' });
		expect(pageCount(raw)).toBe(1);
		expect(raw).toContain('bukan penawaran final');
	});

	it('menghasilkan Blob application/pdf yang diawali %PDF', async () => {
		const { blob, raw } = await render(['offroad'], 40);
		expect(blob.type).toBe('application/pdf');
		expect(raw.startsWith('%PDF')).toBe(true);
		expect(blob.size).toBeGreaterThan(1000);
	});

	it('memuat nama tim, paket, harga, peserta, subtotal, total, dan kalimat bukan penawaran final', async () => {
		const { raw } = await render(['offroad'], 40);
		for (const s of [
			'Tim Alfa',
			'Offroad',
			'Rp 250.000',
			'(40)',
			'Rp 10.000.000',
			'Total estimasi',
			'bukan penawaran final',
			'17 Oktober 2026'
		]) {
			expect(raw, s).toContain(s);
		}
	});

	it('memuat tanggal rencana, catatan, dan keterangan minimal peserta bila ada', async () => {
		const { raw } = await render(['rafting'], 4, { planDate: '2026-11-20', notes: 'Ada vegetarian' });
		expect(raw).toContain('20 November 2026');
		expect(raw).toContain('Ada vegetarian');
		expect(raw).toContain('ditagihkan minimal 10 peserta');
		expect(raw).toContain('Rp 2.000.000');
	});

	it('menampilkan "Harga menyusul" dan "Dibahas via WhatsApp" bila tanpa harga', async () => {
		const { raw } = await render(['fun-games'], 40);
		expect(raw).toContain('Harga menyusul');
		expect(raw).toContain('Dibahas via WhatsApp');
	});

	it('memberi catatan pada total bila sebagian tanpa harga', async () => {
		const { raw } = await render(['offroad', 'fun-games'], 40);
		expect(raw).toContain('belum termasuk paket tanpa harga');
	});

	it('tetap membuat PDF dengan emoji dan tanda kutip tipografis (disaring)', async () => {
		const { raw } = await render(['offroad'], 10, { team: 'Tim 😀 Alfa', notes: '“halo” – ok' });
		expect(raw.startsWith('%PDF')).toBe(true);
		expect(raw).toContain('Tim ? Alfa');
		expect(raw).toContain('"halo" - ok');
		expect(raw).not.toContain('😀');
	});

	it('menambah halaman bila catatan sangat panjang', async () => {
		const long = Array.from({ length: 60 }, (_, i) => `Baris catatan nomor ${i + 1}`).join('\n');
		const { raw } = await render(['offroad'], 10, { notes: long });
		expect(pageCount(raw)).toBeGreaterThan(1);
		expect(raw).toContain('Baris catatan nomor 60');
		expect(raw).toContain('bukan penawaran final');
	});
});
