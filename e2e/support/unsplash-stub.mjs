// Server Unsplash tiruan untuk tes e2e (tanpa jaringan). Meniru bagian API yang dipakai aplikasi:
//   GET /search/photos?query=&page=   GET /photos/:id   GET /photos/:id/download
// Perilaku khusus: kueri "limit" → 403 (jatah habis), "kosong" → tanpa hasil, "rusak" → 500;
// id "hilang01" → 404, "rusak001" → 500. Semua panggilan dicatat dan dapat dibaca di GET /__calls.
import { createServer } from 'node:http';

export const STUB_KEY = 'kunci-uji';
const PER_PAGE = 12;
const TOTAL = 30;

export function startUnsplashStub(port) {
	const calls = [];
	const base = `http://127.0.0.1:${port}`;
	const photo = (id) => ({
		id,
		alt_description: `foto uji ${id}`,
		description: null,
		width: 4000,
		height: 3000,
		urls: {
			raw: `https://images.unsplash.com/photo-${id}?ixlib=rb-4.1.0&ixid=ID${id}`,
			small: `https://images.unsplash.com/photo-${id}?ixlib=rb-4.1.0&w=400&ixid=ID${id}`
		},
		links: { html: `https://unsplash.com/photos/${id}`, download_location: `${base}/photos/${id}/download?ixid=ID${id}` },
		user: { name: `Fotografer ${id}`, links: { html: `https://unsplash.com/@fotografer_${id}` } }
	});

	const server = createServer((req, res) => {
		const url = new URL(req.url, base);
		const send = (status, body) => {
			res.writeHead(status, { 'content-type': 'application/json' });
			res.end(JSON.stringify(body));
		};
		if (url.pathname === '/__calls') return send(200, calls);
		if (req.headers.authorization !== `Client-ID ${STUB_KEY}`) return send(401, { errors: ['OAuth error: The access token is invalid'] });

		if (url.pathname === '/search/photos') {
			const query = url.searchParams.get('query') ?? '';
			const page = Number(url.searchParams.get('page') ?? '1');
			calls.push({ path: 'search', query, page, params: Object.fromEntries(url.searchParams) });
			if (query === 'limit') return send(403, { errors: ['Rate Limit Exceeded'] });
			if (query === 'rusak') return send(500, { errors: ['Internal'] });
			if (query === 'kosong') return send(200, { total: 0, total_pages: 0, results: [] });
			const first = (page - 1) * PER_PAGE;
			const count = Math.max(0, Math.min(PER_PAGE, TOTAL - first));
			const results = Array.from({ length: count }, (_, i) => photo(`fotouji${String(first + i + 1).padStart(2, '0')}`));
			return send(200, { total: TOTAL, total_pages: Math.ceil(TOTAL / PER_PAGE), results });
		}

		const download = url.pathname.match(/^\/photos\/([^/]+)\/download$/);
		if (download) {
			calls.push({ path: 'download', id: download[1] });
			return send(200, { url: `https://images.unsplash.com/photo-${download[1]}` });
		}
		const one = url.pathname.match(/^\/photos\/([^/]+)$/);
		if (one) {
			calls.push({ path: 'photo', id: one[1] });
			if (one[1] === 'hilang01') return send(404, { errors: ["Couldn't find Photo"] });
			if (one[1] === 'rusak001') return send(500, { errors: ['Internal'] });
			return send(200, photo(one[1]));
		}
		return send(404, { errors: ['tidak ada'] });
	});

	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', () => resolve(server));
	});
}
