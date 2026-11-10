/** Header keamanan dasar untuk semua respons. Nilai yang sudah diatur rute (mis. admin `DENY`) dipertahankan. */
export const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Frame-Options': 'SAMEORIGIN',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

/**
 * Cache CDN untuk HTML publik: perubahan admin tampil di belakang CDN paling lambat ±2 menit
 * (60 detik segar + 60 detik basi sambil diperbarui). Browser selalu bertanya ulang ke CDN.
 */
export const PUBLIC_HTML_CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=60';

const PRIVATE_PREFIXES = ['/admin', '/api', '/invoice', '/uploads', '/healthz'];

function isPrivatePath(pathname: string): boolean {
	return PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Pasang header keamanan dan, untuk HTML publik yang sukses, kebijakan cache CDN. */
export function applyResponseHeaders(pathname: string, method: string, response: Response): Response {
	const { headers } = response;
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!headers.has(name)) headers.set(name, value);
	}
	const isHtml = headers.get('content-type')?.startsWith('text/html') ?? false;
	if (
		method === 'GET' &&
		response.status === 200 &&
		isHtml &&
		!isPrivatePath(pathname) &&
		!headers.has('cache-control')
	) {
		headers.set('Cache-Control', PUBLIC_HTML_CACHE);
	}
	return response;
}
