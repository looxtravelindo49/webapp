/**
 * Measurement ID Google Analytics 4 (format `G-XXXXXXX`) dari PUBLIC_GA_MEASUREMENT_ID.
 * Kosong atau formatnya salah → null, dan tag GA tidak dipasang (dev lokal, tes, pratinjau).
 * Validasi ketat karena nilainya ikut ditulis ke dalam skrip inline.
 */
export function gaMeasurementId(raw: string | undefined): string | null {
	const id = raw?.trim().toUpperCase() ?? '';
	return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

/**
 * Halaman yang tidak dilacak: invoice berisi data pelanggan, jadi URL-nya tidak dikirim ke Google.
 * Admin berada di luar layout situs sehingga memang tidak pernah memuat tag.
 */
export function isTrackedPath(pathname: string): boolean {
	return !/^\/invoice(\/|$)/.test(pathname);
}

/** Nama event klik WhatsApp, sama dengan properti GA looxtravel.com supaya laporannya sebanding. */
export const WHATSAPP_EVENT = 'whatsapp_click';

const WHATSAPP_HOSTS = new Set(['wa.me', 'www.wa.me', 'api.whatsapp.com', 'web.whatsapp.com']);

export type WhatsappClickParams = {
	/** Asal tombol: nilai `data-wa` terdekat (float, hero, footer, promo, kalkulator), atau `lainnya`. */
	placement: string;
	/** Nomor tujuan tanpa isi pesan. Teks pesan tidak dikirim karena bisa berisi data pengunjung. */
	link_url: string;
	/** Nama paket bila klik terjadi di halaman detail paket. */
	package?: string;
};

/**
 * Parameter event untuk tautan WhatsApp, atau null bila `href` bukan tautan WhatsApp.
 */
export function whatsappClickParams(
	href: string,
	placement?: string | null,
	packageTitle?: string | null
): WhatsappClickParams | null {
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return null;
	}
	if (!WHATSAPP_HOSTS.has(url.hostname.toLowerCase())) return null;
	const phone = url.searchParams.get('phone');
	const path = phone ? `/${phone.replace(/\D/g, '')}` : url.pathname.replace(/\/+$/, '') || '/';
	const params: WhatsappClickParams = {
		placement: placement?.trim() || 'lainnya',
		link_url: `https://wa.me${path === '/' ? '' : path}`
	};
	const pkg = packageTitle?.trim();
	if (pkg) params.package = pkg;
	return params;
}

type Gtag = (...args: unknown[]) => void;

/** Kirim event ke GA4 bila tag sudah terpasang; tanpa tag (dev, tes, /invoice) tidak melakukan apa pun. */
export function trackEvent(name: string, params: Record<string, unknown>): void {
	const gtag = (globalThis as { gtag?: Gtag }).gtag;
	if (typeof gtag === 'function') gtag('event', name, params);
}
