import { describe, expect, it } from 'vitest';
import { applyResponseHeaders, PUBLIC_HTML_CACHE, SECURITY_HEADERS } from './response-headers';

const html = (status = 200, extra: Record<string, string> = {}) =>
	new Response('<!doctype html>', { status, headers: { 'content-type': 'text/html', ...extra } });

function expectSecurity(res: Response, frame = 'SAMEORIGIN') {
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		expect(res.headers.get(name)).toBe(name === 'X-Frame-Options' ? frame : value);
	}
}

describe('applyResponseHeaders', () => {
	it('halaman publik mendapat header keamanan dan cache CDN', () => {
		for (const path of ['/', '/paket/offroad', '/artikel']) {
			const res = applyResponseHeaders(path, 'GET', html());
			expectSecurity(res);
			expect(res.headers.get('cache-control')).toBe(PUBLIC_HTML_CACHE);
		}
	});

	it('admin mempertahankan DENY dan no-store', () => {
		const res = applyResponseHeaders('/admin/login', 'GET', html(200, { 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' }));
		expectSecurity(res, 'DENY');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});

	it('path admin tanpa Cache-Control tetap tidak di-cache CDN', () => {
		const res = applyResponseHeaders('/admin', 'GET', html());
		expect(res.headers.get('cache-control')).toBeNull();
	});

	it('respons galat membawa header keamanan tanpa cache CDN', () => {
		const res = applyResponseHeaders('/artikel/tidak-ada', 'GET', html(404));
		expectSecurity(res);
		expect(res.headers.get('cache-control')).toBeNull();
	});

	it('invoice mempertahankan no-store', () => {
		const res = applyResponseHeaders('/invoice/INV-1', 'GET', html(200, { 'Cache-Control': 'no-store' }));
		expect(res.headers.get('cache-control')).toBe('no-store');
	});

	it('path privat tidak di-cache walau tanpa Cache-Control', () => {
		for (const path of ['/invoice/INV-1', '/api/leads', '/uploads/a.jpg', '/healthz']) {
			expect(applyResponseHeaders(path, 'GET', html()).headers.get('cache-control')).toBeNull();
		}
	});

	it('path yang hanya berawalan sama tetap publik', () => {
		expect(applyResponseHeaders('/apikasi', 'GET', html()).headers.get('cache-control')).toBe(PUBLIC_HTML_CACHE);
	});

	it('non-HTML dan POST tidak di-cache', () => {
		const json = new Response('{}', { headers: { 'content-type': 'application/json' } });
		expect(applyResponseHeaders('/', 'GET', json).headers.get('cache-control')).toBeNull();
		expect(applyResponseHeaders('/', 'POST', html()).headers.get('cache-control')).toBeNull();
	});

	it('Cache-Control dari rute tidak ditimpa', () => {
		const res = applyResponseHeaders('/sitemap.xml', 'GET', html(200, { 'Cache-Control': 'public, s-maxage=3600' }));
		expect(res.headers.get('cache-control')).toBe('public, s-maxage=3600');
	});
});
