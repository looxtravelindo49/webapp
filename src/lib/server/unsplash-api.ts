import { UnsplashError, type Unsplash } from './unsplash';

export const QUERY_MIN = 2;
export const QUERY_MAX = 80;
export const PAGE_MAX = 20;

const STATUS = { 'not-configured': 503, 'rate-limited': 429, unavailable: 502, 'not-found': 404, invalid: 400 } as const;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** Jawaban endpoint pencarian admin: validasi masukan, panggil Unsplash, petakan galat ke status HTTP. */
export async function searchResponse(unsplash: Unsplash, params: URLSearchParams): Promise<Response> {
	if (!unsplash.enabled) return json({ error: 'not-configured' }, STATUS['not-configured']);

	const q = (params.get('q') ?? '').trim();
	const rawPage = params.get('page') ?? '';
	const page = rawPage === '' ? 1 : /^\d{1,2}$/.test(rawPage) ? Number(rawPage) : NaN;
	if (q.length < QUERY_MIN || q.length > QUERY_MAX || !(page >= 1 && page <= PAGE_MAX)) return json({ error: 'invalid' }, STATUS.invalid);

	try {
		return json(await unsplash.search(q, page));
	} catch (err) {
		const kind = err instanceof UnsplashError ? err.kind : 'unavailable';
		return json({ error: kind }, STATUS[kind]);
	}
}
