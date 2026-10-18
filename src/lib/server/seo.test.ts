import { describe, expect, it } from 'vitest';
import { openDatabase } from './db';
import { health } from './health';
import { robotsTxt, sitemapXml } from './seo';

describe('robots.txt dan sitemap', () => {
	it('melarang /admin/ dan menunjuk sitemap absolut', async () => {
		const txt = robotsTxt('https://contoh.id');
		expect(txt).toContain('Disallow: /admin/');
		expect(txt).toContain('Sitemap: https://contoh.id/sitemap.xml');
	});
	it('sitemap memuat halaman beranda', async () => {
		expect(sitemapXml('https://contoh.id')).toContain('<loc>https://contoh.id/</loc>');
	});
});

describe('health', () => {
	it('200 bila database terbaca', async () => {
		const db = await openDatabase(':memory:');
		const res = await health(async () => db);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
	it('503 bila database gagal dibuka atau ditutup', async () => {
		expect((await health(async () => { throw new Error('x'); })).status).toBe(503);
		const db = await openDatabase(':memory:');
		db.close();
		expect((await health(async () => db)).status).toBe(503);
	});
});
