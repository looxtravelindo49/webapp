import { describe, expect, it, vi } from 'vitest';
import { createUnsplash, PER_PAGE, unsplashConfig, UnsplashError, type FetchLike, type UnsplashConfig } from './unsplash';

const KEY = 'kunci-rahasia-uji-123';
const cfg: UnsplashConfig = { key: KEY, appName: 'lembang_adventures', apiUrl: 'https://api.unsplash.com' };

const photo = (id: string, over: Record<string, unknown> = {}) => ({
	id,
	alt_description: `alt ${id}`,
	description: null,
	width: 4000,
	height: 3000,
	urls: { raw: `https://images.unsplash.com/photo-${id}?ixlib=rb-4.1.0&ixid=ID${id}`, small: `https://images.unsplash.com/photo-${id}?w=400&ixid=ID${id}` },
	links: { html: `https://unsplash.com/photos/${id}`, download_location: `https://api.unsplash.com/photos/${id}/download?ixid=ID${id}` },
	user: { name: 'Ana Budi', links: { html: 'https://unsplash.com/@anabudi' } },
	...over
});
const reply = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function client(handler: FetchLike, config = cfg, now?: () => number) {
	const fetchFn = vi.fn(handler);
	return { u: createUnsplash(config, fetchFn as unknown as FetchLike, now), fetchFn };
}
const kind = async (p: Promise<unknown>) => {
	try {
		await p;
		return 'ok';
	} catch (e) {
		return e instanceof UnsplashError ? e.kind : `bukan UnsplashError: ${String(e)}`;
	}
};

describe('unsplashConfig', () => {
	it('membaca env, dengan nilai bawaan dan tanpa garis miring akhir', () => {
		expect(unsplashConfig({})).toEqual({ key: null, appName: 'lembang_adventures', apiUrl: 'https://api.unsplash.com' });
		expect(unsplashConfig({ UNSPLASH_ACCESS_KEY: ' k ', UNSPLASH_APP_NAME: 'app', UNSPLASH_API_URL: 'http://127.0.0.1:9/' })).toEqual({
			key: 'k', appName: 'app', apiUrl: 'http://127.0.0.1:9'
		});
		expect(unsplashConfig({ UNSPLASH_ACCESS_KEY: '  ' }).key).toBeNull();
	});
});

describe('search', () => {
	it('memanggil search/photos dengan parameter tetap dan header Client-ID', async () => {
		const { u, fetchFn } = client(async () => reply(200, { total: 0, total_pages: 0, results: [] }));
		await u.search('air terjun', 2);
		const [url, init] = fetchFn.mock.calls[0] as [string, { headers: Record<string, string> }];
		const parsed = new URL(url);
		expect(parsed.origin + parsed.pathname).toBe('https://api.unsplash.com/search/photos');
		expect(Object.fromEntries(parsed.searchParams)).toEqual({
			query: 'air terjun', page: '2', per_page: String(PER_PAGE), orientation: 'landscape', content_filter: 'high'
		});
		expect(init.headers.Authorization).toBe(`Client-ID ${KEY}`);
		expect(url).not.toContain(KEY);
	});

	it('menormalkan hasil: hanya kolom yang dipakai, profil tidak valid → null, alt cadangan ke description', async () => {
		const body = {
			total: 40, total_pages: 4,
			results: [
				photo('abc123'),
				photo('def456', { alt_description: null, description: 'deskripsi', user: { name: 'Cici', links: { html: 'https://evil.com/@cici' } } })
			]
		};
		const { u } = client(async () => reply(200, body));
		const page = await u.search('hutan', 1);
		expect(page).toMatchObject({ total: 40, totalPages: 4, page: 1 });
		expect(page.results[0]).toEqual({
			id: 'abc123', thumb: 'https://images.unsplash.com/photo-abc123?w=400&ixid=IDabc123', alt: 'alt abc123', width: 4000, height: 3000,
			user: { name: 'Ana Budi', url: 'https://unsplash.com/@anabudi' }
		});
		expect(page.results[1]).toMatchObject({ alt: 'deskripsi', user: { name: 'Cici', url: null } });
		expect(JSON.stringify(page)).not.toContain('download_location');
		expect(JSON.stringify(page)).not.toContain(KEY);
	});

	it('melewati hasil dengan id, gambar, atau nama tidak sah', async () => {
		const body = {
			total: 3, total_pages: 1,
			results: [
				photo('bagus01'),
				photo('x', {}),
				photo('abc123', { urls: { raw: 'https://evil.com/a', small: 'https://evil.com/a.jpg' } }),
				photo('def456', { user: { name: '', links: {} } })
			]
		};
		const { u } = client(async () => reply(200, body));
		expect((await u.search('x', 1)).results.map((r) => r.id)).toEqual(['bagus01']);
	});

	it('cache: kueri dan halaman sama dalam 10 menit memanggil Unsplash sekali; kedaluwarsa memanggil lagi', async () => {
		let t = 1_000;
		const { u, fetchFn } = client(async () => reply(200, { total: 0, total_pages: 0, results: [] }), cfg, () => t);
		await u.search('Hutan', 1);
		await u.search('hutan', 1); // huruf besar/kecil dianggap sama
		expect(fetchFn).toHaveBeenCalledTimes(1);
		await u.search('hutan', 2);
		expect(fetchFn).toHaveBeenCalledTimes(2);
		t += 10 * 60 * 1000 - 1;
		await u.search('hutan', 1);
		expect(fetchFn).toHaveBeenCalledTimes(2);
		t += 2;
		await u.search('hutan', 1);
		expect(fetchFn).toHaveBeenCalledTimes(3);
	});

	it('cache dibatasi 50 entri: yang tertua dibuang', async () => {
		const { u, fetchFn } = client(async () => reply(200, { total: 0, total_pages: 0, results: [] }));
		for (let i = 0; i < 51; i++) await u.search(`kueri ${i}`, 1);
		expect(fetchFn).toHaveBeenCalledTimes(51);
		await u.search('kueri 50', 1); // masih ada
		expect(fetchFn).toHaveBeenCalledTimes(51);
		await u.search('kueri 0', 1); // sudah terbuang
		expect(fetchFn).toHaveBeenCalledTimes(52);
	});

	it('galat tidak di-cache', async () => {
		let status = 500;
		const { u, fetchFn } = client(async () => reply(status, { total: 0, total_pages: 0, results: [] }));
		expect(await kind(u.search('x1', 1))).toBe('unavailable');
		status = 200;
		expect(await kind(u.search('x1', 1))).toBe('ok');
		expect(fetchFn).toHaveBeenCalledTimes(2);
	});
});

describe('pemetaan galat', () => {
	it.each([[403, 'rate-limited'], [429, 'rate-limited'], [404, 'not-found'], [401, 'unavailable'], [500, 'unavailable'], [503, 'unavailable'], [400, 'unavailable']])(
		'status %i → %s',
		async (status, expected) => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const { u } = client(async () => reply(status));
			expect(await kind(u.search('x', 1))).toBe(expected);
		}
	);
	it('galat jaringan atau waktu habis → unavailable (tanpa membocorkan kunci)', async () => {
		const { u } = client(async () => {
			throw new Error(`gagal terhubung dengan ${KEY}`);
		});
		const err = await u.search('x', 1).catch((e) => e);
		expect(err).toBeInstanceOf(UnsplashError);
		expect(err.kind).toBe('unavailable');
		expect(String(err.message)).not.toContain(KEY);
	});
	it('JSON rusak → unavailable', async () => {
		const { u } = client(async () => ({ ok: true, status: 200, json: async () => { throw new Error('rusak'); } }));
		expect(await kind(u.search('x', 1))).toBe('unavailable');
	});
	it('tanpa kunci → not-configured dan tidak memanggil jaringan', async () => {
		const { u, fetchFn } = client(async () => reply(200), { ...cfg, key: null });
		expect(u.enabled).toBe(false);
		expect(await kind(u.search('x', 1))).toBe('not-configured');
		expect(await kind(u.getPhoto('abc123'))).toBe('not-configured');
		expect(fetchFn).not.toHaveBeenCalled();
	});
});

describe('getPhoto', () => {
	it('mengambil URL raw, nama, profil, dan lokasi unduhan dari API', async () => {
		const { u, fetchFn } = client(async () => reply(200, photo('abc123')));
		expect(await u.getPhoto('abc123')).toEqual({
			id: 'abc123',
			raw: 'https://images.unsplash.com/photo-abc123?ixlib=rb-4.1.0&ixid=IDabc123',
			name: 'Ana Budi',
			profile: 'https://unsplash.com/@anabudi',
			downloadLocation: 'https://api.unsplash.com/photos/abc123/download?ixid=IDabc123'
		});
		expect(fetchFn.mock.calls[0][0]).toBe('https://api.unsplash.com/photos/abc123');
	});
	it.each(['', 'abc', 'a'.repeat(41), 'abc/../x', 'abc 123', 'abc?x=1', 'abc%2F123'])('id %j ditolak tanpa memanggil jaringan', async (id) => {
		const { u, fetchFn } = client(async () => reply(200, photo('abc123')));
		expect(await kind(u.getPhoto(id))).toBe('invalid');
		expect(fetchFn).not.toHaveBeenCalled();
	});
	it('404 → not-found', async () => {
		const { u } = client(async () => reply(404));
		expect(await kind(u.getPhoto('hilang1'))).toBe('not-found');
	});
	it('URL raw dari host lain, nama kosong, atau tanpa download_location → unavailable', async () => {
		for (const bad of [
			photo('abc123', { urls: { raw: 'https://evil.com/a.jpg' } }),
			photo('abc123', { user: { name: '' } }),
			photo('abc123', { links: {} })
		]) {
			const { u } = client(async () => reply(200, bad));
			expect(await kind(u.getPhoto('abc123'))).toBe('unavailable');
		}
	});
	it('profil tidak valid disimpan sebagai null', async () => {
		const { u } = client(async () => reply(200, photo('abc123', { user: { name: 'Ana', links: { html: 'https://evil.com/@ana' } } })));
		expect((await u.getPhoto('abc123')).profile).toBeNull();
	});
});

describe('trackDownload', () => {
	it('memanggil download_location dengan kunci sebanyak satu kali', async () => {
		const { u, fetchFn } = client(async () => reply(200, { url: 'x' }));
		expect(await u.trackDownload('https://api.unsplash.com/photos/abc123/download?ixid=ID')).toBe(true);
		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect((fetchFn.mock.calls[0][1] as { headers: Record<string, string> }).headers.Authorization).toBe(`Client-ID ${KEY}`);
	});
	it('host selain host API tidak dipanggil (kunci tidak terkirim)', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const { u, fetchFn } = client(async () => reply(200));
		expect(await u.trackDownload('https://evil.example/photos/abc123/download')).toBe(false);
		expect(await u.trackDownload('bukan url')).toBe(false);
		expect(fetchFn).not.toHaveBeenCalled();
	});
	it('galat tidak pernah dilempar dan tidak membocorkan kunci ke log', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { u } = client(async () => {
			throw new Error(`gagal ${KEY}`);
		});
		expect(await u.trackDownload('https://api.unsplash.com/photos/abc123/download')).toBe(false);
		expect(JSON.stringify(error.mock.calls)).not.toContain(KEY);
	});
	it('respons non-OK → false', async () => {
		const { u } = client(async () => reply(500));
		expect(await u.trackDownload('https://api.unsplash.com/photos/abc123/download')).toBe(false);
	});
});
