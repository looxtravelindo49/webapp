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
