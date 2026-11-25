import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	calculatorErrorType,
	firstChangedField,
	gaMeasurementId,
	generateLeadParams,
	isTrackedPath,
	trackEvent,
	whatsappClickParams
} from './analytics';

const blank = { paket: '', tambahan: '', nama: '', whatsapp: '', peserta: '', tanggal: '', catatan: '' };

describe('firstChangedField', () => {
	it('null bila belum ada perubahan', () => {
		expect(firstChangedField(blank, { ...blank })).toBeNull();
	});
	it('nama kolom yang berubah, bukan isinya', () => {
		expect(firstChangedField(blank, { ...blank, peserta: '40' })).toBe('peserta');
		expect(firstChangedField(blank, { ...blank, paket: 'offroad' })).toBe('paket');
	});
});

describe('calculatorErrorType', () => {
	it('membedakan jaringan, ditolak, dan server', () => {
		expect(calculatorErrorType(null)).toBe('jaringan');
		expect(calculatorErrorType(400)).toBe('ditolak');
		expect(calculatorErrorType(429)).toBe('ditolak');
		expect(calculatorErrorType(503)).toBe('server');
	});
});

describe('generateLeadParams', () => {
	it('nilai Rupiah, peserta, dan paket', () => {
		expect(generateLeadParams({ total: 7_500_000, pax: 30, packages: ['Offroad', 'Rafting'] })).toEqual({
			lead_source: 'kalkulator',
			currency: 'IDR',
			value: 7_500_000,
			pax: 30,
			package: 'Offroad, Rafting'
		});
	});
	it('tanpa value bila paket tidak berharga', () => {
		expect(generateLeadParams({ total: 0, pax: null, packages: [] })).toEqual({
			lead_source: 'kalkulator',
			currency: 'IDR'
		});
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('whatsappClickParams', () => {
	it('mengenali wa.me dan membuang isi pesan', () => {
		expect(whatsappClickParams('https://wa.me/6282120209900?text=Halo%20Nama%3A%20Budi', 'float')).toEqual({
			placement: 'float',
			link_url: 'https://wa.me/6282120209900'
		});
	});
	it('mengenali api.whatsapp.com dengan parameter phone', () => {
		expect(whatsappClickParams('https://api.whatsapp.com/send?phone=6282120209900&text=x')).toEqual({
			placement: 'lainnya',
			link_url: 'https://wa.me/6282120209900'
		});
	});
	it('menyertakan nama paket bila ada', () => {
		expect(whatsappClickParams('https://wa.me/62811', 'hero', '  Tur Jeep ')).toEqual({
			placement: 'hero',
			link_url: 'https://wa.me/62811',
			package: 'Tur Jeep'
		});
	});
	it('null untuk tautan lain atau URL rusak', () => {
		expect(whatsappClickParams('https://www.lembangadventure.com/paket/x')).toBeNull();
		expect(whatsappClickParams('https://evilwa.me/62811')).toBeNull();
		expect(whatsappClickParams('/paket')).toBeNull();
	});
});

describe('trackEvent', () => {
	it('memanggil gtag bila ada', () => {
		const gtag = vi.fn();
		vi.stubGlobal('gtag', gtag);
		trackEvent('whatsapp_click', { placement: 'float' });
		expect(gtag).toHaveBeenCalledWith('event', 'whatsapp_click', { placement: 'float' });
	});
	it('tidak melakukan apa pun tanpa gtag', () => {
		expect(() => trackEvent('whatsapp_click', {})).not.toThrow();
	});
});

describe('gaMeasurementId', () => {
	it('menerima ID GA4 yang valid', () => {
		expect(gaMeasurementId('G-36FN6W9XYM')).toBe('G-36FN6W9XYM');
		expect(gaMeasurementId('  g-36fn6w9xym ')).toBe('G-36FN6W9XYM');
	});
	it('null bila kosong atau formatnya salah', () => {
		expect(gaMeasurementId(undefined)).toBeNull();
		expect(gaMeasurementId('')).toBeNull();
		expect(gaMeasurementId('UA-12345-1')).toBeNull();
		expect(gaMeasurementId('GTM-ABCDEF')).toBeNull();
		expect(gaMeasurementId("G-ABC');alert(1);//")).toBeNull();
	});
});

describe('isTrackedPath', () => {
	it('melacak halaman publik', () => {
		expect(isTrackedPath('/')).toBe(true);
		expect(isTrackedPath('/paket/tur-jeep')).toBe(true);
		expect(isTrackedPath('/invoicer')).toBe(true);
	});
	it('tidak melacak invoice', () => {
		expect(isTrackedPath('/invoice')).toBe(false);
		expect(isTrackedPath('/invoice/INV-001')).toBe(false);
	});
});
