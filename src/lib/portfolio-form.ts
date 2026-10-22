export const PORTFOLIO_LIMITS = {
	title: 120,
	location: 120,
	eventDate: 80,
	eventType: 60,
	caption: 280,
	alt: 180
} as const;

export type PortfolioRaw = {
	title: string;
	location: string;
	eventDate: string;
	eventType: string;
	caption: string;
	alt: string;
	removePhoto: boolean;
};

export type PortfolioValues = {
	title: string;
	location: string;
	eventDate: string;
	eventType: string;
	caption: string;
	alt: string | null;
	removePhoto: boolean;
};

export type PortfolioErrors = Partial<Record<'title' | 'location' | 'eventDate' | 'eventType' | 'caption' | 'alt', string>>;

const text = (form: FormData, name: string) => String(form.get(name) ?? '');

export function emptyPortfolioRaw(): PortfolioRaw {
	return { title: '', location: '', eventDate: '', eventType: '', caption: '', alt: '', removePhoto: false };
}

/** Validasi teks. Foto diperiksa terpisah. `imageKept` benar bila setelah simpan masih ada foto. */
export function parsePortfolioForm(form: FormData, imageKept: boolean): { raw: PortfolioRaw; ok: true; values: PortfolioValues } | { raw: PortfolioRaw; ok: false; errors: PortfolioErrors } {
	const raw: PortfolioRaw = {
		title: text(form, 'title'),
		location: text(form, 'location'),
		eventDate: text(form, 'event_date'),
		eventType: text(form, 'event_type'),
		caption: text(form, 'caption'),
		alt: text(form, 'alt'),
		removePhoto: form.get('remove_photo') === 'yes'
	};
	const errors: PortfolioErrors = {};
	const title = raw.title.trim();
	const location = raw.location.trim();
	const eventDate = raw.eventDate.trim();
	const eventType = raw.eventType.trim();
	const caption = raw.caption.trim();
	const alt = raw.alt.trim();
	if (!title) errors.title = 'Judul wajib diisi.';
	else if (title.length > PORTFOLIO_LIMITS.title) errors.title = `Judul maksimal ${PORTFOLIO_LIMITS.title} karakter.`;
	if (!location) errors.location = 'Lokasi wajib diisi.';
	else if (location.length > PORTFOLIO_LIMITS.location) errors.location = `Lokasi maksimal ${PORTFOLIO_LIMITS.location} karakter.`;
	if (!eventDate) errors.eventDate = 'Tanggal wajib diisi.';
	else if (eventDate.length > PORTFOLIO_LIMITS.eventDate) errors.eventDate = `Tanggal maksimal ${PORTFOLIO_LIMITS.eventDate} karakter.`;
	if (!eventType) errors.eventType = 'Jenis kegiatan wajib diisi.';
	else if (eventType.length > PORTFOLIO_LIMITS.eventType) errors.eventType = `Jenis kegiatan maksimal ${PORTFOLIO_LIMITS.eventType} karakter.`;
	if (!caption) errors.caption = 'Keterangan singkat wajib diisi.';
	else if (caption.length > PORTFOLIO_LIMITS.caption) errors.caption = `Keterangan maksimal ${PORTFOLIO_LIMITS.caption} karakter.`;
	if (imageKept && !alt) errors.alt = 'Teks alternatif wajib diisi bila ada foto.';
	else if (alt.length > PORTFOLIO_LIMITS.alt) errors.alt = `Teks alternatif maksimal ${PORTFOLIO_LIMITS.alt} karakter.`;
	if (Object.keys(errors).length) return { raw, ok: false, errors };
	return {
		raw,
		ok: true,
		values: { title, location, eventDate, eventType, caption, alt: alt || null, removePhoto: raw.removePhoto }
	};
}
