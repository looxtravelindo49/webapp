import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
	it('memformat tanggal panjang bahasa Indonesia', () => {
		expect(formatDate('2026-09-15T00:00:00.000Z')).toBe('15 September 2026');
	});
	it('memakai zona WIB (UTC+7) agar tidak bergantung zona server', () => {
		expect(formatDate('2026-09-15T20:00:00.000Z')).toBe('16 September 2026');
	});
	it('kosong atau tidak valid → string kosong', () => {
		expect(formatDate(null)).toBe('');
		expect(formatDate('')).toBe('');
		expect(formatDate('bukan tanggal')).toBe('');
	});
});
