import { describe, expect, it } from 'vitest';
import { openDatabase } from './db';
import { health } from './health';
import { robotsTxt, sitemapXml } from './seo';

describe('robots.txt dan sitemap', () => {
	it('melarang /admin/ dan menunjuk sitemap absolut', () => {
		const txt = robotsTxt('https://contoh.id');
		expect(txt).toContain('Disallow: /admin/');
		expect(txt).toContain('Sitemap: https://contoh.id/sitemap.xml');
	});
	it('sitemap memuat halaman beranda', () => {
		expect(sitemapXml('https://contoh.id')).toContain('<loc>https://contoh.id/</loc>');
	});
});

describe('health', () => {
	it('200 bila database terbaca', async () => {
		const db = openDatabase(':memory:');
		const res = health(() => db);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
	it('503 bila database gagal dibuka atau ditutup', () => {
		expect(health(() => { throw new Error('x'); }).status).toBe(503);
		const db = openDatabase(':memory:');
		db.close();
		expect(health(() => db).status).toBe(503);
	});
});
