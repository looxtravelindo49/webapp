import { describe, expect, it } from 'vitest';
import { activityFromHash, kegiatanHash } from './kegiatan';

describe('kegiatan hash', () => {
	it('membentuk hash yang bisa dibagikan', () => {
		expect(kegiatanHash('offroad')).toBe('#kegiatan-offroad');
		expect(kegiatanHash('team-building')).toBe('#kegiatan-team-building');
	});

	it('mengenali hash kegiatan dan hash paket yang lama', () => {
		expect(activityFromHash('#kegiatan-offroad')).toEqual({ slug: 'offroad', bringIntoView: true });
		expect(activityFromHash('#paket-rafting')).toEqual({ slug: 'rafting', bringIntoView: false });
		expect(activityFromHash('#kegiatan-fun%2Dgames')).toEqual({ slug: 'fun-games', bringIntoView: true });
	});

	it('mengabaikan hash lain dan hash rusak', () => {
		expect(activityFromHash('')).toBeNull();
		expect(activityFromHash('#paket')).toBeNull();
		expect(activityFromHash('#konsultasi')).toBeNull();
		expect(activityFromHash('#kegiatan-')).toBeNull();
		expect(activityFromHash('#kegiatan-%')).toBeNull();
	});
});