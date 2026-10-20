import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bank, bankLogo } from './content/bank';
import { hero } from './content/hero';
import {
	buildInvoiceNumber,
	dpNominal,
	DP_PERCENT,
	INVOICE_NUMBER,
	invoiceStamp,
	parseStoredLines,
	suffixFromBytes
} from './invoice';

describe('nomor invoice', () => {
	it('memakai tanggal WIB, bukan UTC', () => {
		expect(invoiceStamp(new Date('2026-10-19T16:30:00.000Z'))).toBe('20261019');
		expect(invoiceStamp(new Date('2026-10-19T17:30:00.000Z'))).toBe('20261020');
	});

	it('8 byte menjadi akhiran yang lolos pola dan tidak bentrok untuk byte berbeda', () => {
		const a = buildInvoiceNumber(new Date('2026-10-20T02:00:00.000Z'), Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]));
		const b = buildInvoiceNumber(new Date('2026-10-20T02:00:00.000Z'), Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 8]));
		expect(a).toMatch(INVOICE_NUMBER);
		expect(a.startsWith('LA-20261020-')).toBe(true);
		expect(a).not.toBe(b);
		expect(suffixFromBytes(new Uint8Array(8))).toBe('AAAAAAAA');
	});
});

describe('DP 20%', () => {
	it('dihitung dari estimasi dan kosong bila belum ada angka', () => {
		expect(DP_PERCENT).toBe(20);
		expect(dpNominal(10_000_000)).toBe(2_000_000);
		expect(dpNominal(1)).toBe(0);
		expect(dpNominal(null)).toBeNull();
	});
});

describe('baris tersimpan', () => {
	it('mengabaikan JSON rusak', () => {
		expect(parseStoredLines('bukan')).toEqual([]);
		expect(parseStoredLines('{"title":"x"}')).toEqual([]);
	});
});

describe('aset fase 1', () => {
	it('hero memakai foto natural dan alt yang diminta', () => {
		expect(hero.image).toBe('/media/hero-2.jpg');
		expect(hero.imageAlt).toBe(
			'Tiga mobil offroad melintasi jalur berbatu di hutan pinus Lembang saat kegiatan outbound rombongan.'
		);
	});

	it('rekening dan peringatan sesuai spek', () => {
		expect(bank).toMatchObject({ bank: 'CIMB Niaga Syariah', account: '860025788700', holder: 'Loox Travel Luxury' });
		expect(bank.warning).toBe(
			'Hati-hati memilih travel. Pastikan travel sudah berbadan hukum PT dan hanya transfer ke rekening atas nama PT untuk menghindari penipuan.'
		);
		expect(bankLogo.alt).toBe('CIMB Niaga Syariah');
		const png = readFileSync(new URL(`../../static${bankLogo.src}`, import.meta.url));
		expect(png.readUInt32BE(16)).toBe(bankLogo.width);
		expect(png.readUInt32BE(20)).toBe(bankLogo.height);
	});
});
