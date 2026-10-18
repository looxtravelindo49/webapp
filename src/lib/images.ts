export const FALLBACK_IMAGE = '/media/forest.svg';

const SAFE = /^\/(media|uploads)\/[a-zA-Z0-9_./%-]+\.(svg|webp|png|jpe?g|avif)$/i;

/** Hanya path lokal /media/… atau /uploads/… tanpa `..`; selain itu pakai gambar bawaan. */
export function safeImage(path: string | null | undefined): string {
	return path && SAFE.test(path) && !path.includes('..') ? path : FALLBACK_IMAGE;
}
