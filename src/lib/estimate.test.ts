import { describe, expect, it } from 'vitest';
import { formatPlanDate, lineText, totalNote, totalText, unitBreakdown } from './estimate';
import { buildConfirmationMessage } from './invoice';
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

describe('formatPlanDate', () => {
	it('memformat tanggal Indonesia tanpa bergeser hari', () => {
		expect(formatPlanDate('2026-11-20')).toBe('20 November 2026');
		expect(formatPlanDate('2026-01-01')).toBe('1 Januari 2026');
	});
	it('mengembalikan string kosong untuk masukan tidak valid', () => {
		expect(formatPlanDate('')).toBe('');
		expect(formatPlanDate('20/11/2026')).toBe('');
		expect(formatPlanDate('2026-13-45')).toBe('');
	});
});

describe('teks total dan baris', () => {
	it('complete: rupiah tanpa catatan', () => {
		const e = calculateEstimate(packages, ['offroad'], 40);
		expect(totalText(e)).toBe('Rp 10.000.000');
		expect(totalNote(e)).toBe('');
	});
	it('partial: ada catatan', () => {
		const e = calculateEstimate(packages, ['offroad', 'fun-games'], 40);
		expect(totalText(e)).toBe('Rp 10.000.000');
		expect(totalNote(e)).toBe('belum termasuk paket tanpa harga');
	});
	it('quote-only: Dibahas via WhatsApp', () => {
		expect(totalText(calculateEstimate(packages, ['fun-games'], 40))).toBe('Dibahas via WhatsApp');
	});
	it('lineText: harga, minimal peserta, dan harga menyusul', () => {
		const e = calculateEstimate(packages, ['offroad', 'rafting', 'fun-games'], 4);
		expect(e.lines.map(lineText)).toEqual([
			'4 x Rp 250.000 = Rp 1.000.000',
			'10 x Rp 200.000 = Rp 2.000.000 (minimal 10 peserta)',
			'Harga menyusul'
		]);
	});
	it('lineText per satuan: mobil penuh', () => {
		const offroad = {
			...pkg('offroad', 'Offroad', 249000, 7),
			pricing_mode: 'per_unit' as const,
			kapasitas_per_unit: 7,
			nama_unit: 'mobil'
		};
		const e = calculateEstimate([offroad], ['offroad'], 20);
		expect(lineText(e.lines[0])).toBe(unitBreakdown(3, 7 * 249_000, 7, 'mobil'));
		expect(lineText(e.lines[0])).toBe('3 mobil × Rp 1.743.000 (maks. 7 orang/mobil)');
	});
});

describe('buildConfirmationMessage', () => {
	const msg = (slugs: string[], extra: Partial<Parameters<typeof buildConfirmationMessage>[0]> = {}) => {
		const pax = extra.pax ?? 40;
		const estimate = extra.estimate ?? calculateEstimate(packages, slugs, pax);
		return buildConfirmationMessage({
			nama: 'Tim Alfa',
			whatsapp: '6281234567890',
			titles: estimate.lines.map((l) => l.title),
			pax,
			planDate: '',
			estimate,
			notes: '',
			invoiceUrl: 'https://www.lembangadventure.com/invoice/LA-20261020-ABCDEFGH',
			...extra
		});
	};

	it('memuat detail, estimasi, dan tautan invoice tanpa menyebut PDF', () => {
		const text = msg(['offroad', 'rafting']);
		expect(text).toContain('Halo Lembang Adventure, aku barusan hitung di kalkulator website.');
		expect(text).toContain('Nama: Tim Alfa');
		expect(text).toContain('Nomor WhatsApp: +6281234567890');
		expect(text).toContain('Paket: Offroad, Rafting');
		expect(text).toContain('Jumlah peserta: 40 orang');
		expect(text).toContain('Tanggal: Belum ditentukan');
		expect(text).toContain('Estimasi: Rp 18.000.000');
		expect(text).toContain('Link invoice: https://www.lembangadventure.com/invoice/LA-20261020-ABCDEFGH');
		expect(text).toContain('konfirmasi harga finalnya?');
		expect(text.toLowerCase()).not.toContain('pdf');
		expect(text.toLowerCase()).not.toContain('lampir');
	});

	it('menyertakan tanggal dan catatan', () => {
		const text = msg(['offroad'], { planDate: '2026-11-20', notes: '  Ada vegetarian  ' });
		expect(text).toContain('Tanggal: 20 November 2026');
		expect(text).toContain('Catatan: Ada vegetarian');
	});

	it('sebagian tanpa harga disebut di samping estimasi', () => {
		expect(msg(['offroad', 'fun-games'])).toContain('Estimasi: Rp 10.000.000 (belum termasuk paket tanpa harga)');
	});

	it('semua tanpa harga: Dibahas via WhatsApp', () => {
		expect(msg(['fun-games'])).toContain('Estimasi: Dibahas via WhatsApp');
	});
});
