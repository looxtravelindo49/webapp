import { describe, expect, it } from 'vitest';
import {
	buildWhatsappMessage,
	formatPlanDate,
	lineText,
	pdfFilename,
	sanitizePdfText,
	totalNote,
	totalText
} from './estimate';
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
const input = (slugs: string[], pax = 40, extra: Partial<Parameters<typeof buildWhatsappMessage>[0]> = {}) => ({
	team: 'Tim Alfa',
	pax,
	estimate: calculateEstimate(packages, slugs, pax),
	planDate: '',
	notes: '',
	...extra
});

describe('pdfFilename', () => {
	const day = new Date(2026, 9, 17); // 17 Oktober 2026 (lokal)
	it('mem-slug nama tim', () => {
		expect(pdfFilename('PT Maju & Jaya!', day)).toBe('estimasi-trip-pt-maju-jaya-2026-10-17.pdf');
	});
	it('membuang diakritik', () => {
		expect(pdfFilename('Café Naïve', day)).toBe('estimasi-trip-cafe-naive-2026-10-17.pdf');
	});
	it('fallback "tim" bila hanya simbol atau kosong', () => {
		expect(pdfFilename('!!! ???', day)).toBe('estimasi-trip-tim-2026-10-17.pdf');
		expect(pdfFilename('', day)).toBe('estimasi-trip-tim-2026-10-17.pdf');
		expect(pdfFilename('😀', day)).toBe('estimasi-trip-tim-2026-10-17.pdf');
	});
	it('tidak memuat karakter berbahaya untuk nama berkas dan membatasi panjang', () => {
		const name = pdfFilename('../../etc/passwd\\x:*?"<>|' + 'a'.repeat(100), day);
		expect(name).toMatch(/^estimasi-trip-[a-z0-9-]+-2026-10-17\.pdf$/);
		expect(name.length).toBeLessThan(80);
	});
	it('menambah nol di depan bulan dan hari', () => {
		expect(pdfFilename('x', new Date(2026, 0, 5))).toBe('estimasi-trip-x-2026-01-05.pdf');
	});
});

describe('sanitizePdfText', () => {
	it('memetakan tanda baca tipografis ke ASCII', () => {
		expect(sanitizePdfText('“halo” – ‘dunia’ — ok…')).toBe('"halo" - \'dunia\' - ok...');
	});
	it('mengganti emoji dengan satu "?" per karakter', () => {
		expect(sanitizePdfText('Tim 😀 Alfa')).toBe('Tim ? Alfa');
		expect(sanitizePdfText('日本')).toBe('??');
	});
	it('mempertahankan huruf Latin-1 dan baris baru', () => {
		expect(sanitizePdfText('café × 2\nbaris dua')).toBe('café × 2\nbaris dua');
	});
	it('menormalkan CRLF dan tab', () => {
		expect(sanitizePdfText('a\r\nb\tc')).toBe('a\nb c');
	});
});

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
});

describe('buildWhatsappMessage', () => {
	it('pesan lengkap tanpa tanggal dan catatan', () => {
		const msg = buildWhatsappMessage(input(['offroad']));
		expect(msg).toBe(
			[
				'Halo Lembang Adventures, saya ingin konsultasi trip.',
				'',
				'Nama tim: Tim Alfa',
				'Paket:',
				'- Offroad: 40 x Rp 250.000 = Rp 10.000.000',
				'Peserta: 40 orang',
				'Tanggal rencana: Belum ditentukan',
				'Estimasi total: Rp 10.000.000',
				'Catatan: -',
				'',
				'Mohon dibantu penawarannya. Saya lampirkan PDF estimasinya.'
			].join('\n')
		);
	});
	it('menyertakan tanggal dan catatan yang di-trim', () => {
		const msg = buildWhatsappMessage(input(['offroad'], 40, { planDate: '2026-11-20', notes: '  Ada vegetarian  ' }));
		expect(msg).toContain('Tanggal rencana: 20 November 2026');
		expect(msg).toContain('Catatan: Ada vegetarian');
	});
	it('menyertakan nomor WhatsApp bila diisi dan menghilangkannya bila kosong', () => {
		expect(buildWhatsappMessage(input(['offroad'], 40, { whatsapp: '6281234567890' }))).toContain(
			'Nama tim: Tim Alfa\nNomor WhatsApp: +6281234567890\nPaket:'
		);
		expect(buildWhatsappMessage(input(['offroad']))).not.toContain('Nomor WhatsApp');
	});
	it('sebagian tanpa harga: catatan di samping total dan baris "Harga menyusul"', () => {
		const msg = buildWhatsappMessage(input(['offroad', 'fun-games']));
		expect(msg).toContain('- Fun Games: Harga menyusul');
		expect(msg).toContain('Estimasi total: Rp 10.000.000 (belum termasuk paket tanpa harga)');
	});
	it('semua tanpa harga: Dibahas via WhatsApp', () => {
		expect(buildWhatsappMessage(input(['fun-games']))).toContain('Estimasi total: Dibahas via WhatsApp');
	});
	it('mencantumkan minimal peserta yang ditagihkan', () => {
		expect(buildWhatsappMessage(input(['rafting'], 4))).toContain(
			'- Rafting: 10 x Rp 200.000 = Rp 2.000.000 (minimal 10 peserta)'
		);
	});
});
