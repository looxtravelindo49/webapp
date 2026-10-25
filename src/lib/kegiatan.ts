/** Hash berbagi untuk membuka satu tab di section "Pilih Kegiatan". */
const ACTIVITY_HASH = /^#(kegiatan|paket)-([^#]+)$/;

export const KEGIATAN_EVENT = 'la-kegiatan';

export function kegiatanHash(slug: string): string {
	return `#kegiatan-${slug}`;
}

/**
 * Slug dari hash kegiatan. `bringIntoView` hanya untuk `#kegiatan-`:
 * `#paket-` lama tetap memilih tab, tetapi klik pil tidak boleh melompatkan halaman.
 */
export function activityFromHash(hash: string): { slug: string; bringIntoView: boolean } | null {
	const match = ACTIVITY_HASH.exec(hash);
	if (!match) return null;
	let slug = match[2];
	try {
		slug = decodeURIComponent(slug);
	} catch {
		return null;
	}
	if (!slug) return null;
	return { slug, bringIntoView: match[1] === 'kegiatan' };
}

/** Ganti hash tanpa lompatan browser, lalu minta tab kegiatan dibuka. */
export function openKegiatan(slug: string): void {
	const next = kegiatanHash(slug);
	if (location.hash !== next) history.replaceState(null, '', next);
	window.dispatchEvent(new CustomEvent<string>(KEGIATAN_EVENT, { detail: slug }));
}
