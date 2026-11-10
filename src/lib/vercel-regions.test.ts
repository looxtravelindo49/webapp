import { describe, expect, it } from 'vitest';
import { vercelRegions } from './vercel-regions';

describe('vercelRegions', () => {
	it('memakai hnd1 bila VERCEL_REGIONS tidak diatur', () => {
		expect(vercelRegions({})).toEqual(['hnd1']);
	});

	it('memakai hnd1 bila VERCEL_REGIONS kosong atau hanya spasi/koma', () => {
		expect(vercelRegions({ VERCEL_REGIONS: '' })).toEqual(['hnd1']);
		expect(vercelRegions({ VERCEL_REGIONS: ' , ' })).toEqual(['hnd1']);
	});

	it('memakai satu region dari env', () => {
		expect(vercelRegions({ VERCEL_REGIONS: 'sin1' })).toEqual(['sin1']);
	});

	it('memisah beberapa region dan membuang spasi', () => {
		expect(vercelRegions({ VERCEL_REGIONS: 'sin1, hnd1' })).toEqual(['sin1', 'hnd1']);
	});
});
