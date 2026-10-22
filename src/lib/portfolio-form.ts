export const PORTFOLIO_LIMITS = { alt: 180, caption: 280 } as const;
/** Satu unggahan sekaligus, di bawah batas badan permintaan serverless. */
export const MAX_PORTFOLIO_BATCH = 12;
export const MAX_PORTFOLIO_BATCH_BYTES = 4 * 1024 * 1024;

export type PortfolioPhotoText = { alt: string; caption: string | null };

/** Alt wajib dan keterangan opsional, satu pasang per foto, urutan sama dengan berkas. */
export function parsePortfolioBatch(alts: string[], captions: string[], count: number): { ok: true; items: PortfolioPhotoText[] } | { ok: false; error: string } {
	if (count < 1) return { ok: false, error: 'Pilih minimal satu foto.' };
	if (count > MAX_PORTFOLIO_BATCH) return { ok: false, error: `Unggah paling banyak ${MAX_PORTFOLIO_BATCH} foto sekaligus.` };
	if (alts.length !== count) return { ok: false, error: 'Isi teks alternatif untuk setiap foto.' };
	const items: PortfolioPhotoText[] = [];
	for (let i = 0; i < count; i++) {
		const alt = alts[i]?.trim() ?? '';
		const caption = (captions[i] ?? '').trim();
		if (!alt) return { ok: false, error: `Teks alternatif foto ${i + 1} wajib diisi.` };
		if (alt.length > PORTFOLIO_LIMITS.alt) return { ok: false, error: `Teks alternatif foto ${i + 1} maksimal ${PORTFOLIO_LIMITS.alt} karakter.` };
		if (caption.length > PORTFOLIO_LIMITS.caption) return { ok: false, error: `Keterangan foto ${i + 1} maksimal ${PORTFOLIO_LIMITS.caption} karakter.` };
		items.push({ alt, caption: caption || null });
	}
	return { ok: true, items };
}

export function parsePortfolioText(altRaw: string, captionRaw: string): { ok: true; alt: string; caption: string | null } | { ok: false; error: string } {
	const alt = altRaw.trim();
	const caption = captionRaw.trim();
	if (!alt) return { ok: false, error: 'Teks alternatif wajib diisi.' };
	if (alt.length > PORTFOLIO_LIMITS.alt) return { ok: false, error: `Teks alternatif maksimal ${PORTFOLIO_LIMITS.alt} karakter.` };
	if (caption.length > PORTFOLIO_LIMITS.caption) return { ok: false, error: `Keterangan maksimal ${PORTFOLIO_LIMITS.caption} karakter.` };
	return { ok: true, alt, caption: caption || null };
}
