import { describe, expect, it } from 'vitest';
import { gaMeasurementId, isTrackedPath } from './analytics';

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
