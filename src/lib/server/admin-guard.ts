export const ADMIN_LOGIN = '/admin/login';
export const ADMIN_CHANGE_PASSWORD = '/admin/ganti-password';
export const ADMIN_LOGOUT = '/admin/logout';

export type GuardUser = { must_change_password: number } | null;

/** Path berawalan `/admin` (bukan `/administrator`, dll.). */
export function isAdminPath(pathname: string): boolean {
	return pathname === '/admin' || pathname.startsWith('/admin/');
}

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/**
 * Keputusan akses area admin. Mengembalikan path tujuan redirect, atau null bila permintaan
 * boleh dilanjutkan.
 * - tanpa sesi: hanya halaman login yang boleh;
 * - sesi + wajib ganti password: hanya halaman ganti password dan keluar;
 * - sesi di halaman login: arahkan masuk.
 */
export function guardAdmin(pathname: string, user: GuardUser): string | null {
	if (!isAdminPath(pathname)) return null;
	const path = trim(pathname);

	if (!user) return path === ADMIN_LOGIN ? null : ADMIN_LOGIN;

	if (user.must_change_password) {
		return path === ADMIN_CHANGE_PASSWORD || path === ADMIN_LOGOUT ? null : ADMIN_CHANGE_PASSWORD;
	}
	return path === ADMIN_LOGIN ? '/admin' : null;
}

/** Header yang dipasang pada semua respons area admin. */
export const ADMIN_HEADERS: Record<string, string> = {
	'Cache-Control': 'no-store',
	'X-Robots-Tag': 'noindex, nofollow',
	'X-Frame-Options': 'DENY'
};
