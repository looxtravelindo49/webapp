import { describe, expect, it } from 'vitest';
import {
	formatBerlakuHingga,
	formatSisaWaktu,
	parseJakartaDateTime,
	resolveValidity,
	validityRemaining,
	validitySnapshot
} from './invoice-validity';

const now = new Date('2026-10-27T02:00:00.000Z');

describe('masa berlaku invoice', () => {
	it('membaca tanggal sebagai WIB dan menolak tanggal yang tidak ada', () => {
		expect(parseJakartaDateTime('2026-10-28T16:30')?.toISOString()).toBe('2026-10-28T09:30:00.000Z');
		expect(parseJakartaDateTime('2026-02-31T10:00')).toBeNull();
		expect(formatBerlakuHingga('2026-10-28T09:30:00.000Z')).toBe('28 Oktober 2026, 16.30 WIB');
	});

	it('menerapkan jam, hari, atau tanggal tanpa durasi bawaan', () => {
		expect(resolveValidity({ action: 'terapkan', mode: 'jam', nilai: '6', current: null, now })).toEqual({
			ok: true,
			iso: '2026-10-27T08:00:00.000Z'
		});
		expect(resolveValidity({ action: 'terapkan', mode: 'hari', nilai: '2', current: null, now })).toEqual({
			ok: true,
			iso: '2026-10-29T02:00:00.000Z'
		});
		expect(resolveValidity({ action: 'terapkan', mode: 'waktu', nilai: '2026-10-28T16:30', current: null, now })).toEqual({
			ok: true,
			iso: '2026-10-28T09:30:00.000Z'
		});
		expect(resolveValidity({ action: 'terapkan', mode: '', nilai: '', current: null, now }).ok).toBe(false);
		expect(resolveValidity({ action: 'terapkan', mode: 'jam', nilai: '', current: null, now }).ok).toBe(false);
		expect(resolveValidity({ action: 'terapkan', mode: 'waktu', nilai: '2026-10-27T08:00', current: null, now }).ok).toBe(false);
	});

	it('memperpanjang dari batas yang masih jalan dan menghapus saat direset', () => {
		const current = '2026-10-27T06:00:00.000Z';
		expect(resolveValidity({ action: 'perpanjang', mode: 'jam', nilai: '3', current, now })).toEqual({
			ok: true,
			iso: '2026-10-27T09:00:00.000Z'
		});
		expect(resolveValidity({ action: 'perpanjang', mode: 'hari', nilai: '1', current: '2026-10-26T00:00:00.000Z', now })).toEqual({
			ok: true,
			iso: '2026-10-28T02:00:00.000Z'
		});
		expect(resolveValidity({ action: 'perpanjang', mode: 'waktu', nilai: '2026-11-01T10:00', current, now }).ok).toBe(false);
		expect(resolveValidity({ action: 'reset', mode: '', nilai: '', current, now })).toEqual({ ok: true, iso: null });
	});

	it('menghitung sisa waktu dan menganggap invoice tanpa batas sebagai tidak tampil', () => {
		expect(formatSisaWaktu(validityRemaining('2026-10-27T04:00:00.000Z', now))).toBe('02:00:00');
		expect(formatSisaWaktu(validityRemaining('2026-10-28T05:12:08.000Z', now))).toBe('1 hari 03:12:08');
		expect(validityRemaining('2026-10-27T02:00:00.000Z', now).expired).toBe(true);
		expect(validitySnapshot(null, now)).toBeNull();
		expect(validitySnapshot('bukan-waktu', now)).toBeNull();
		expect(validitySnapshot('2026-10-27T01:00:00.000Z', now)?.expired).toBe(true);
	});
});
