/** Jeda geser otomatis galeri di halaman detail paket. */
export const GALLERY_INTERVAL_MS = 4000;

/** Geser horizontal dianggap gesekan bila melewati ambang ini dan lebih besar dari gerak vertikal. */
export const GALLERY_SWIPE_PX = 40;

/** Indeks berikutnya, memutar di ujung. `count` 0 tetap di 0. */
export function stepGallery(index: number, count: number, direction: 1 | -1): number {
	if (count <= 0) return 0;
	return (index + direction + count) % count;
}

/** Indeks yang tampil sebagai thumbnail: semua foto selain yang sedang besar, urutan asli. */
export function thumbnailIndexes(count: number, selected: number): number[] {
	const current = count <= 0 ? 0 : Math.min(Math.max(Math.trunc(selected) || 0, 0), count - 1);
	return Array.from({ length: count }, (_, i) => i).filter((i) => i !== current);
}

/** 1 = maju (geser ke kiri), -1 = mundur, 0 = bukan gesekan. */
export function swipeDirection(dx: number, dy: number, threshold = GALLERY_SWIPE_PX): 1 | -1 | 0 {
	if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return 0;
	return dx < 0 ? 1 : -1;
}

/** Teks alternatif yang tampil: alt foto, atau cadangan (alt paket / nama paket). */
export function slideAlt(alt: string | null | undefined, fallback: string): string {
	const text = alt?.trim();
	return text || fallback;
}
