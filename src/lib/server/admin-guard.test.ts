import { describe, expect, it } from 'vitest';
import { ADMIN_HEADERS, guardAdmin, isAdminPath } from './admin-guard';

const normal = { must_change_password: 0 };
const mustChange = { must_change_password: 1 };

describe('isAdminPath', () => {
	it.each(['/admin', '/admin/', '/admin/login', '/admin/akun/x'])('%s adalah path admin', (p) => expect(isAdminPath(p)).toBe(true));
	it.each(['/', '/administrator', '/adminx', '/api/admin', '/healthz'])('%s bukan path admin', (p) => expect(isAdminPath(p)).toBe(false));
});

describe('guardAdmin', () => {
	it('situs publik tidak pernah diarahkan', () => {
		for (const u of [null, normal, mustChange]) {
			expect(guardAdmin('/', u)).toBeNull();
			expect(guardAdmin('/healthz', u)).toBeNull();
			expect(guardAdmin('/administrator', u)).toBeNull();
		}
	});

	it('tanpa sesi: semua path admin dialihkan ke login kecuali login itu sendiri', () => {
		for (const p of ['/admin', '/admin/', '/admin/akun', '/admin/ganti-password', '/admin/logout', '/admin/apa-saja']) {
			expect(guardAdmin(p, null), p).toBe('/admin/login');
		}
		expect(guardAdmin('/admin/login', null)).toBeNull();
		expect(guardAdmin('/admin/login/', null)).toBeNull();
	});

	it('sesi normal: bebas ke halaman admin; dari login diarahkan ke /admin', () => {
		for (const p of ['/admin', '/admin/akun', '/admin/ganti-password', '/admin/logout', '/admin/paket']) {
			expect(guardAdmin(p, normal), p).toBeNull();
		}
		expect(guardAdmin('/admin/login', normal)).toBe('/admin');
	});

	it('wajib ganti password: hanya ganti password dan keluar yang boleh', () => {
		expect(guardAdmin('/admin/ganti-password', mustChange)).toBeNull();
		expect(guardAdmin('/admin/ganti-password/', mustChange)).toBeNull();
		expect(guardAdmin('/admin/logout', mustChange)).toBeNull();
		for (const p of ['/admin', '/admin/', '/admin/akun', '/admin/paket', '/admin/login']) {
			expect(guardAdmin(p, mustChange), p).toBe('/admin/ganti-password');
		}
	});

	it('tidak bisa melewati penjaga dengan variasi path', () => {
		expect(guardAdmin('/admin/akun/', null)).toBe('/admin/login');
		expect(guardAdmin('/admin//akun', null)).toBe('/admin/login');
		expect(guardAdmin('/admin/Akun', mustChange)).toBe('/admin/ganti-password');
	});
});

describe('ADMIN_HEADERS', () => {
	it('memuat no-store, noindex, dan frame deny', () => {
		expect(ADMIN_HEADERS['Cache-Control']).toBe('no-store');
		expect(ADMIN_HEADERS['X-Robots-Tag']).toBe('noindex, nofollow');
		expect(ADMIN_HEADERS['X-Frame-Options']).toBe('DENY');
	});
});
