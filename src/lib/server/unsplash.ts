import { isUnsplashImage, isUnsplashProfile, PHOTO_ID } from '#lib/images.js';

/**
 * Klien API Unsplash (hanya di server). Kunci akses tidak pernah dikembalikan ke pemanggil, dimasukkan ke
 * pesan galat, atau dicatat. Semua gambar tetap di-hotlink dari URL yang dikembalikan API.
 */

export type UnsplashConfig = { key: string | null; appName: string; apiUrl: string };

export function unsplashConfig(env: Record<string, string | undefined> = process.env): UnsplashConfig {
	return {
		key: env.UNSPLASH_ACCESS_KEY?.trim() || null,
		appName: env.UNSPLASH_APP_NAME?.trim() || 'lembang_adventures',
		apiUrl: (env.UNSPLASH_API_URL?.trim() || 'https://api.unsplash.com').replace(/\/+$/, '')
	};
}

export type UnsplashErrorKind = 'not-configured' | 'rate-limited' | 'unavailable' | 'not-found' | 'invalid';

export class UnsplashError extends Error {
	constructor(readonly kind: UnsplashErrorKind) {
		super(kind);
		this.name = 'UnsplashError';
	}
}

export const PER_PAGE = 12;
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 50;

export type SearchPhoto = {
	id: string;
	thumb: string;
	alt: string;
	width: number;
	height: number;
	user: { name: string; url: string | null };
};
export type SearchPage = { total: number; totalPages: number; page: number; results: SearchPhoto[] };
export type Photo = { id: string; raw: string; name: string; profile: string | null; downloadLocation: string };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export type FetchLike = (url: string, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

export function createUnsplash(config: UnsplashConfig, fetchFn: FetchLike = fetch as FetchLike, now: () => number = Date.now) {
	const cache = new Map<string, { at: number; value: SearchPage }>();

	function request(url: string) {
		if (!config.key) throw new UnsplashError('not-configured');
		return fetchFn(url, {
			headers: { Authorization: `Client-ID ${config.key}`, 'Accept-Version': 'v1' },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	}

	async function getJson(url: string): Promise<Json> {
		let res: Awaited<ReturnType<typeof request>>;
		try {
			res = await request(url);
		} catch (err) {
			if (err instanceof UnsplashError) throw err;
			throw new UnsplashError('unavailable');
		}
		if (res.status === 403 || res.status === 429) throw new UnsplashError('rate-limited');
		if (res.status === 404) throw new UnsplashError('not-found');
		if (!res.ok) {
			if (res.status === 401) console.error('[unsplash] kunci akses ditolak (401); periksa UNSPLASH_ACCESS_KEY');
			throw new UnsplashError('unavailable');
		}
		try {
			return obj(await res.json());
		} catch {
			throw new UnsplashError('unavailable');
		}
	}

	return {
		enabled: config.key !== null,
		appName: config.appName,

		/** Cari foto lanskap; hasil dinormalkan dan di-cache 10 menit per kueri dan halaman. */
		async search(query: string, page: number): Promise<SearchPage> {
			if (!config.key) throw new UnsplashError('not-configured');
			const cacheKey = `${page}|${query.toLowerCase()}`;
			const hit = cache.get(cacheKey);
			if (hit && now() - hit.at < CACHE_TTL_MS) return hit.value;

			const params = new URLSearchParams({
				query,
				page: String(page),
				per_page: String(PER_PAGE),
				orientation: 'landscape',
				content_filter: 'high'
			});
			const json = await getJson(`${config.apiUrl}/search/photos?${params}`);
			const results: SearchPhoto[] = [];
			for (const item of Array.isArray(json.results) ? json.results : []) {
				const p = obj(item);
				const user = obj(p.user);
				const thumb = str(obj(p.urls).small);
				const id = str(p.id);
				if (!PHOTO_ID.test(id) || !isUnsplashImage(thumb) || !str(user.name)) continue;
				const profile = str(obj(user.links).html);
				results.push({
					id,
					thumb,
					alt: str(p.alt_description) || str(p.description),
					width: num(p.width),
					height: num(p.height),
					user: { name: str(user.name), url: isUnsplashProfile(profile) ? profile : null }
				});
			}
			const value: SearchPage = { total: num(json.total), totalPages: num(json.total_pages), page, results };
			if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
			cache.set(cacheKey, { at: now(), value });
			return value;
		},

		/** Ambil satu foto dari API: sumber tepercaya untuk URL, kredit, dan lokasi pelacakan unduhan. */
		async getPhoto(id: string): Promise<Photo> {
			if (!PHOTO_ID.test(id)) throw new UnsplashError('invalid');
			const p = await getJson(`${config.apiUrl}/photos/${encodeURIComponent(id)}`);
			const raw = str(obj(p.urls).raw);
			const name = str(obj(p.user).name);
			const downloadLocation = str(obj(p.links).download_location);
			if (!isUnsplashImage(raw) || !name || !downloadLocation) throw new UnsplashError('unavailable');
			const profile = str(obj(obj(p.user).links).html);
			return { id, raw, name, profile: isUnsplashProfile(profile) ? profile : null, downloadLocation };
		},

		/**
		 * Beri tahu Unsplash bahwa foto dipakai (wajib menurut panduan API). Hanya ke host API yang
		 * dikonfigurasi supaya kunci tidak terkirim ke alamat lain. Tidak pernah melempar.
		 */
		async trackDownload(location: string): Promise<boolean> {
			try {
				if (new URL(location).origin !== new URL(config.apiUrl).origin) {
					console.error('[unsplash] download_location menunjuk ke host lain; pelacakan dilewati');
					return false;
				}
				const res = await request(location);
				return res.ok;
			} catch {
				console.error('[unsplash] gagal mencatat unduhan');
				return false;
			}
		}
	};
}

export type Unsplash = ReturnType<typeof createUnsplash>;

let instance: Unsplash | undefined;
/** Instance bersama (cache pencarian dipakai lintas permintaan); dibaca dari environment saat pertama dipakai. */
export function getUnsplash(): Unsplash {
	return (instance ??= createUnsplash(unsplashConfig()));
}
