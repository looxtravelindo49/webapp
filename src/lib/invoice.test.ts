import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bank, bankLogo } from './content/bank';
import { hero } from './content/hero';
import {
	buildClientInvoiceMessage,
	buildInvoiceNumber,
	buildPaymentProofMessage,
	displayedDp,
	dpCaption,
	dpNominal,
	dpPayLabel,
	feeDetail,
	formatHundredthsInput,
	invoiceChrome,
	manualQuote,
	normalizeFeeLabel,
	normalizeIncludeText,
	parsePercentHundredths,
	parseStoredLines,
	settlement,
	DEFAULT_FEE_LABEL,
	DP_PERCENT,
	INVOICE_NUMBER,
	invoiceStamp,
	parseReceivedAmount,
	paymentBadge,
	suffixFromBytes,
	todayInJakarta
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

describe('DP 30%', () => {
	it('dihitung dari estimasi dan kosong bila belum ada angka', () => {
		expect(DP_PERCENT).toBe(30);
		expect(dpNominal(10_000_000)).toBe(3_000_000);
		expect(dpNominal(1)).toBe(0);
		expect(dpNominal(null)).toBeNull();
	});

	it('lead lama yang DP-nya turunan persen ditampilkan ulang, nominal lain tidak', () => {
		expect(displayedDp(1_000_000, 200_000, 20)).toBe(300_000);
		expect(displayedDp(1_000_000, 300_000, 30)).toBe(300_000);
		expect(displayedDp(1_000_000, 250_000, 20)).toBe(250_000);
		expect(displayedDp(null, null, 20)).toBeNull();
		expect(displayedDp(null, 200_000, 20)).toBe(200_000);
	});

	it('DP yang dikunci admin tidak diselaraskan ke 30%', () => {
		expect(displayedDp(1_000_000, 200_000, 20, 'persen')).toBe(200_000);
		expect(displayedDp(1_000_000, 250_000, 25, 'nominal')).toBe(250_000);
		expect(displayedDp(null, 250_000, 25, 'nominal')).toBe(250_000);
		expect(dpCaption(null, 20)).toBe('DP 30%');
		expect(dpCaption('persen', 15)).toBe('DP 15%');
		expect(dpCaption('nominal', 30)).toBe('DP');
		expect(dpPayLabel(null, 20)).toBe('Bayar DP 30% (segera)');
		expect(dpPayLabel('nominal', 30)).toBe('Bayar DP (segera)');
	});
});

describe('tampilan invoice menurut status', () => {
	it('Baru tetap estimasi, lunas dapat stempel, DP dan batal tanpa ajakan bayar', () => {
		expect(invoiceChrome('baru')).toMatchObject({ title: 'Invoice Estimasi', badge: 'Baru', stamp: false, showPayCta: true });
		expect(invoiceChrome('lunas')).toMatchObject({ title: 'Invoice Lunas', badge: 'LUNAS', stamp: true, showPayCta: false });
		expect(invoiceChrome('dp_diterima')).toMatchObject({ title: 'Invoice', badge: 'DP diterima', showPayCta: false });
		expect(invoiceChrome('batal')).toMatchObject({ title: 'Invoice', badge: 'Dibatalkan', showPayCta: false });
	});

	it('sisa tagihan memakai jumlah yang dicatat, atau DP bila jumlah kosong', () => {
		expect(settlement(1_000_000, 200_000, 150_000)).toEqual({ paid: 150_000, remaining: 850_000 });
		expect(settlement(1_000_000, 200_000, null)).toEqual({ paid: 200_000, remaining: 800_000 });
		expect(settlement(1_000_000, 200_000, 1_500_000).remaining).toBe(0);
	});
});

describe('invoice manual', () => {
	it('menghitung total setelah diskon dan DP dari konstanta', () => {
		expect(manualQuote([{ qty: 2, harga: 249_000 }, { qty: 1, harga: 100_000 }], 49_000)).toEqual({
			subtotal: 598_000,
			diskon: 49_000,
			fee: 0,
			total: 549_000,
			dp: Math.round((549_000 * DP_PERCENT) / 100),
			dpPersen: DP_PERCENT,
			dpMode: null
		});
		expect(manualQuote([{ qty: 1, harga: 1000 }], 1001)).toBeNull();
	});

	it('fee persen atau nominal masuk total, dan DP bisa dikunci', () => {
		const net = 598_000 - 49_000;
		const fee = Math.round((net * 1050) / 10_000);
		const withFee = manualQuote([{ qty: 2, harga: 249_000 }, { qty: 1, harga: 100_000 }], 49_000, {
			fee: { mode: 'persen', value: 1050 }
		});
		expect(withFee).toMatchObject({ fee, total: net + fee, dpMode: null, dp: Math.round(((net + fee) * DP_PERCENT) / 100) });
		expect(
			manualQuote([{ qty: 1, harga: 500_000 }], 0, {
				fee: { mode: 'nominal', value: 25_000 },
				dp: { mode: 'nominal', value: 200_000 }
			})
		).toMatchObject({ subtotal: 500_000, fee: 25_000, total: 525_000, dp: 200_000, dpMode: 'nominal' });
		expect(manualQuote([{ qty: 1, harga: 100_000 }], 0, { dp: { mode: 'persen', value: 30 } })?.dpMode).toBeNull();
		expect(manualQuote([{ qty: 1, harga: 100_000 }], 0, { dp: { mode: 'persen', value: 10 } })).toMatchObject({
			dp: 10_000,
			dpPersen: 10,
			dpMode: 'persen'
		});
		expect(manualQuote([{ qty: 1, harga: 100_000 }], 0, { dp: { mode: 'nominal', value: 100_001 } })).toBeNull();
		expect(manualQuote([{ qty: 1, harga: 100_000 }], 0, { fee: { mode: 'persen', value: 10_001 } })).toBeNull();
	});

	it('Include dan judul fee dinormalisasi, baris lama tanpa field baru tetap terbaca', () => {
		expect(parsePercentHundredths('10,5')).toEqual({ ok: true, value: 1050 });
		expect(formatHundredthsInput(1050)).toBe('10.5');
		expect(formatHundredthsInput(1000)).toBe('10');
		expect(normalizeIncludeText('  Jeep \n\n  Pemandu  ')).toEqual({ ok: true, value: 'Jeep\nPemandu' });
		expect(normalizeIncludeText('x'.repeat(2001)).ok).toBe(false);
		expect(normalizeFeeLabel('  ')).toEqual({ ok: true, value: DEFAULT_FEE_LABEL });
		expect(normalizeFeeLabel('x'.repeat(81)).ok).toBe(false);
		const lines = parseStoredLines(
			JSON.stringify([
				{ title: 'Lama', price: 1000, minPax: 1, billedPax: 2, subtotal: 2000 },
				{
					title: 'Fee Services',
					price: null,
					minPax: 1,
					billedPax: 1,
					subtotal: 200,
					kind: 'fee',
					flat: true,
					feeMode: 'persen',
					feeRate: 1000
				},
				{ title: 'Offroad', price: 249000, minPax: 1, billedPax: 2, subtotal: 498000, kind: 'bebas', includes: 'Jeep\nPemandu' }
			])
		);
		expect(lines[0]).toMatchObject({ title: 'Lama', kind: 'paket' });
		expect(lines[0].includes).toBeUndefined();
		expect(lines[1]).toMatchObject({ kind: 'fee', feeMode: 'persen', feeRate: 1000, subtotal: 200 });
		expect(feeDetail(lines[1])).toBe('10% dari subtotal setelah diskon');
		expect(lines[2].includes).toBe('Jeep\nPemandu');
	});

	it('pesan ke klien memuat nomor dan tautan', () => {
		const text = buildClientInvoiceMessage({
			nama: 'Sari',
			nomor: 'LA-20261020-ABCDEFGH',
			total: 'Rp 549.000',
			dp: 'Rp 109.800',
			invoiceUrl: 'https://lembangadventure.com/invoice/LA-20261020-ABCDEFGH'
		});
		expect(text).toContain('Halo Sari');
		expect(text).toContain('Nomor invoice: LA-20261020-ABCDEFGH');
		expect(text).toContain('https://lembangadventure.com/invoice/LA-20261020-ABCDEFGH');
		expect(text).toContain(`DP ${DP_PERCENT}%:`);
		expect(text.toLowerCase()).not.toContain('pdf');
	});
});

describe('status bayar manual', () => {
	it('lencana memakai tanggal hanya untuk DP diterima dan lunas', () => {
		expect(paymentBadge('baru', null)).toBe('Baru');
		expect(paymentBadge('batal', '2026-10-20')).toBe('Batal');
		expect(paymentBadge('dp_diterima', '2026-10-20')).toBe('DP diterima · 20 Oktober 2026');
		expect(paymentBadge('lunas', '2026-10-01')).toBe('Lunas · 1 Oktober 2026');
	});

	it('pesan bukti transfer hanya memuat nomor invoice', () => {
		const text = buildPaymentProofMessage('LA-20261020-ABCDEFGH');
		expect(text).toContain('Nomor invoice: LA-20261020-ABCDEFGH');
		expect(text.toLowerCase()).not.toContain('pdf');
		expect(text).not.toContain('628');
	});

	it('nominal diterima opsional dan menolak pecahan', () => {
		expect(parseReceivedAmount('')).toEqual({ ok: true, value: null });
		expect(parseReceivedAmount('Rp 1.500.000')).toEqual({ ok: true, value: 1_500_000 });
		expect(parseReceivedAmount('1500.5').ok).toBe(false);
		expect(todayInJakarta(new Date('2026-10-19T17:30:00.000Z'))).toBe('2026-10-20');
	});
});

describe('baris tersimpan', () => {
	it('mengabaikan JSON rusak', () => {
		expect(parseStoredLines('bukan')).toEqual([]);
		expect(parseStoredLines('{"title":"x"}')).toEqual([]);
	});
});

describe('cetak invoice', () => {
	it('CSS cetak memakai A4, Urbanist, warna merek, dan tidak memotong baris', () => {
		const css = readFileSync(new URL('./invoice-print.css', import.meta.url), 'utf8');
		expect(css).toContain('size: A4 portrait');
		expect(css).toContain('margin: 16mm 14mm 18mm');
		expect(css).toMatch(/font-family:\s*Urbanist/);
		expect(css.toLowerCase()).toContain('#0d01ff');
		expect(css.toLowerCase()).toContain('#e5ff00');
		expect(css).toContain('break-inside: avoid');
		expect(css).toContain('.print-hide');
		expect(css).toContain('.no-print');
		expect(css).toContain('print-color-adjust: exact');
		expect(css).toContain('.invoice-valid-until');
		expect(css).toContain('.invoice-countdown');
		expect(css).toMatch(/\.invoice-valid-until\s*\{[^}]*display:\s*none/);
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
