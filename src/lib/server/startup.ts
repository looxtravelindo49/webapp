/**
 * Jalankan inisialisasi saat start (boleh asinkron). Bila gagal, catat galatnya lalu hentikan
 * proses (exit code 1) agar orkestrator bisa me-restart, bukan membiarkan server menggantung.
 */
export async function initOrExit(
	init: () => unknown,
	exit: (code: number) => never = (code) => process.exit(code)
): Promise<void> {
	try {
		await init();
	} catch (err) {
		console.error('[db] gagal start:', err);
		exit(1);
	}
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Di produksi, `PUBLIC_SITE_URL` yang kosong atau menunjuk ke host lokal membuat canonical, Open Graph,
 * dan sitemap salah alamat. Cukup peringatan: server tetap berjalan (e2e menjalankan build produksi di 127.0.0.1).
 */
export function warnIfLocalSiteUrl(
	env: Record<string, string | undefined> = process.env,
	warn: (message: string) => void = (m) => console.warn(m)
): boolean {
	if (env.NODE_ENV !== 'production') return false;
	let host = '';
	try {
		host = new URL(env.PUBLIC_SITE_URL ?? '').hostname;
	} catch {
		// kosong atau tidak valid: dianggap lokal
	}
	if (host && !LOCAL_HOSTS.has(host)) return false;
	warn(
		`[seo] PUBLIC_SITE_URL ${env.PUBLIC_SITE_URL ? `(${env.PUBLIC_SITE_URL}) menunjuk ke host lokal` : 'belum diatur'}: ` +
			'canonical, Open Graph, dan sitemap akan memakai alamat lokal. Isi dengan domain produksi.'
	);
	return true;
}
