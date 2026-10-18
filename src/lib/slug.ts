/** "Café & Ñandú 100%!" → "cafe-nandu-100". Hanya a-z, 0-9, dan tanda hubung; fallback "paket". */
export function slugify(title: string): string {
	const slug = title
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/g, '');
	return slug || 'paket';
}

/** Tambahkan sufiks -2, -3, … bila slug sudah dipakai. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
	const used = new Set(taken);
	if (!used.has(base)) return base;
	for (let n = 2; ; n++) {
		const candidate = `${base}-${n}`;
		if (!used.has(candidate)) return candidate;
	}
}
