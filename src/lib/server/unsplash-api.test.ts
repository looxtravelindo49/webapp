import { describe, expect, it, vi } from 'vitest';
import { searchResponse } from './unsplash-api';
import { UnsplashError, type Unsplash } from './unsplash';

const page = { total: 1, totalPages: 1, page: 1, results: [{ id: 'abc123', thumb: 'https://images.unsplash.com/x', alt: '', width: 1, height: 1, user: { name: 'A', url: null } }] };
const fake = (over: Partial<Record<'search', ReturnType<typeof vi.fn>>> & { enabled?: boolean } = {}) =>
	({ enabled: over.enabled ?? true, appName: 'app', search: over.search ?? vi.fn(async () => page) }) as unknown as Unsplash & { search: ReturnType<typeof vi.fn> };
const run = (u: Unsplash, qs: string) => searchResponse(u, new URLSearchParams(qs));

describe('searchResponse', () => {
	it('200 dengan JSON hasil; kueri dipangkas dan halaman bawaan 1', async () => {
		const u = fake();
		const res = await run(u, 'q=%20air%20terjun%20');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toContain('application/json');
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(await res.json()).toEqual(page);
		expect(u.search).toHaveBeenCalledWith('air terjun', 1);
	});

	it.each(['', 'q=', 'q=a', 'q=%20a%20', `q=${'a'.repeat(81)}`, 'q=ab&page=0', 'q=ab&page=21', 'q=ab&page=abc', 'q=ab&page=-1', 'q=ab&page=1.5', 'q=ab&page=001'])(
		'masukan tidak valid (%s) → 400 tanpa memanggil Unsplash',
		async (qs) => {
			const u = fake();
			const res = await run(u, qs);
			expect(res.status).toBe(400);
			expect(await res.json()).toEqual({ error: 'invalid' });
			expect(u.search).not.toHaveBeenCalled();
		}
	);

	it('batas tepat diterima: kueri 2 dan 80 karakter, halaman 1 dan 20', async () => {
		for (const qs of ['q=ab', `q=${'a'.repeat(80)}`, 'q=ab&page=1', 'q=ab&page=20']) {
			expect((await run(fake(), qs)).status, qs).toBe(200);
		}
	});

	it.each([['rate-limited', 429], ['unavailable', 502], ['not-found', 404]] as const)('galat %s → %i', async (kind, status) => {
		const u = fake({ search: vi.fn(async () => { throw new UnsplashError(kind); }) });
		const res = await run(u, 'q=hutan');
		expect(res.status).toBe(status);
		expect(await res.json()).toEqual({ error: kind });
	});

	it('galat tak dikenal → 502 unavailable', async () => {
		const u = fake({ search: vi.fn(async () => { throw new Error('aneh'); }) });
		const res = await run(u, 'q=hutan');
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({ error: 'unavailable' });
	});

	it('tanpa kunci → 503 not-configured', async () => {
		const u = fake({ enabled: false });
		const res = await run(u, 'q=hutan');
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: 'not-configured' });
		expect(u.search).not.toHaveBeenCalled();
	});
});
