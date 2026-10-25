import { optionalImage } from './images';

/** Nomor klaim promo. Tidak mengikuti pengaturan WhatsApp admin. */
export const PROMO_WA_NUMBER = '6282120209900';
export const PROMO_WA_TEXT = 'Halo Loox, saya mau klaim promo grup di atas 30 orang';
export const PROMO_FINE = 'Syarat & ketentuan berlaku. Nominal diskon mengikuti paket dan jumlah peserta.';
/** Ditulis e2e sebelum halaman dimuat agar popup tidak menutupi tes lain. */
export const PROMO_SUPPRESS_KEY = 'la_promo_suppress';
export const PROMO_DELAY_MS = 1500;
export const PROMO_SETTING_KEY = 'promo';

export type Promo = {
	enabled: boolean;
	label: string;
	title: string;
	amount: string;
	/** Paragraf, lalu baris "1. …" yang tampil sebagai daftar langkah. */
	conditions: string;
	/** `datetime-local`, ditafsirkan sebagai WIB (UTC+7). Popup hilang mulai waktu ini. */
	endsAt: string;
	cta: string;
	image: string;
	imageAlt: string;
};

export const DEFAULT_PROMO: Promo = {
	enabled: true,
	label: 'Promo Oktober',
	title: 'Diskon up to',
	amount: 'Rp500.000',
	conditions:
		'Untuk booking grup di atas 30 orang. Berlaku sampai 31 Oktober 2026.\n1. Isi form paket secara lengkap.\n2. Hubungi kami untuk klaim diskon.',
	endsAt: '2026-11-01T00:00',
	cta: 'Isi Form Paket',
	image: '/media/promo-team.webp',
	imageAlt: 'Team building karyawan bersama Loox Travel'
};

export const PROMO_LIMITS = {
	label: 40,
	title: 80,
	amount: 40,
	conditions: 600,
	cta: 40,
	imageAlt: 200
} as const;

const ENDS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2})?$/;

/** Waktu berakhir sebagai instan UTC, atau null bila formatnya bukan `YYYY-MM-DDTHH:mm`. */
export function promoEndsAt(value: string): Date | null {
	const match = ENDS.exec(value);
	if (!match) return null;
	const date = new Date(`${match[1]}:00+07:00`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Bentuk `datetime-local` tanpa detik, atau string asli bila tidak dikenali. */
export function promoEndsInput(value: string): string {
	return ENDS.exec(value)?.[1] ?? value;
}

/** Aktif bila dinyalakan dan sekarang masih sebelum waktu berakhir (WIB). */
export function promoIsLive(promo: Promo, now = new Date()): boolean {
	if (!promo.enabled) return false;
	const end = promoEndsAt(promo.endsAt);
	if (!end) return false;
	return now.getTime() < end.getTime();
}

/**
 * Kunci localStorage penutupan. Berubah bila isi yang terlihat berubah,
 * jadi mengedit promo menampilkannya lagi.
 */
export function promoDismissKey(promo: Pick<Promo, 'label' | 'title' | 'amount' | 'conditions' | 'endsAt' | 'cta' | 'image'>): string {
	const raw = [promo.label, promo.title, promo.amount, promo.conditions, promo.endsAt, promo.cta, promo.image].join('\n');
	let hash = 2166136261;
	for (let i = 0; i < raw.length; i++) {
		hash ^= raw.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return `la_promo_closed_${(hash >>> 0).toString(36)}`;
}

export function promoCopy(conditions: string): { lead: string; steps: string[] } {
	const lead: string[] = [];
	const steps: string[] = [];
	for (const line of conditions.split('\n')) {
		const text = line.trim();
		if (!text) continue;
		const step = text.match(/^\d+\.\s+(.+)$/);
		if (step) steps.push(step[1]);
		else lead.push(text);
	}
	return { lead: lead.join(' '), steps };
}

export type PromoField = 'label' | 'title' | 'amount' | 'conditions' | 'endsAt' | 'cta' | 'imageAlt' | 'image';
export type PromoErrors = Partial<Record<PromoField, string>>;

function clip(value: unknown, max: number): string {
	return String(value ?? '').trim().slice(0, max + 80);
}

/** Baca JSON pengaturan. Nilai rusak jatuh ke bawaan; `enabled: false` tetap mati. */
export function promoFromStored(raw: string | null | undefined): Promo {
	if (!raw) return { ...DEFAULT_PROMO };
	try {
		const value = JSON.parse(raw) as Partial<Promo>;
		const image = optionalImage(typeof value.image === 'string' ? value.image : '') ?? DEFAULT_PROMO.image;
		const endsAt = typeof value.endsAt === 'string' && promoEndsAt(value.endsAt) ? promoEndsInput(value.endsAt) : DEFAULT_PROMO.endsAt;
		return {
			enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_PROMO.enabled,
			label: textOr(value.label, DEFAULT_PROMO.label, PROMO_LIMITS.label),
			title: textOr(value.title, DEFAULT_PROMO.title, PROMO_LIMITS.title),
			amount: textOr(value.amount, DEFAULT_PROMO.amount, PROMO_LIMITS.amount),
			conditions: textOr(value.conditions, DEFAULT_PROMO.conditions, PROMO_LIMITS.conditions),
			endsAt,
			cta: textOr(value.cta, DEFAULT_PROMO.cta, PROMO_LIMITS.cta),
			image,
			imageAlt: textOr(value.imageAlt, DEFAULT_PROMO.imageAlt, PROMO_LIMITS.imageAlt)
		};
	} catch {
		return { ...DEFAULT_PROMO };
	}
}

function textOr(value: unknown, fallback: string, max: number): string {
	if (typeof value !== 'string') return fallback;
	const text = value.trim();
	if (!text || text.length > max) return fallback;
	return text;
}

export function parsePromoForm(form: { get(name: string): unknown }): { promo: Promo; errors: PromoErrors } {
	const label = clip(form.get('label'), PROMO_LIMITS.label);
	const title = clip(form.get('title'), PROMO_LIMITS.title);
	const amount = clip(form.get('amount'), PROMO_LIMITS.amount);
	const conditions = clip(form.get('conditions'), PROMO_LIMITS.conditions);
	const endsAt = promoEndsInput(String(form.get('ends_at') ?? '').trim());
	const cta = clip(form.get('cta'), PROMO_LIMITS.cta);
	const imageAlt = clip(form.get('image_alt'), PROMO_LIMITS.imageAlt);
	const image = optionalImage(String(form.get('current_image') ?? '')) ?? DEFAULT_PROMO.image;
	const promo: Promo = {
		enabled: form.get('enabled') === '1',
		label,
		title,
		amount,
		conditions,
		endsAt,
		cta,
		image,
		imageAlt
	};
	const errors: PromoErrors = {};
	if (!label) errors.label = 'Isi label promo.';
	else if (label.length > PROMO_LIMITS.label) errors.label = `Label maksimal ${PROMO_LIMITS.label} karakter.`;
	if (!title) errors.title = 'Isi judul promo.';
	else if (title.length > PROMO_LIMITS.title) errors.title = `Judul maksimal ${PROMO_LIMITS.title} karakter.`;
	if (!amount) errors.amount = 'Isi nominal promo.';
	else if (amount.length > PROMO_LIMITS.amount) errors.amount = `Nominal maksimal ${PROMO_LIMITS.amount} karakter.`;
	if (!conditions) errors.conditions = 'Isi syarat promo.';
	else if (conditions.length > PROMO_LIMITS.conditions) errors.conditions = `Syarat maksimal ${PROMO_LIMITS.conditions} karakter.`;
	if (!promoEndsAt(endsAt)) errors.endsAt = 'Isi tanggal dan jam berakhir. Waktu dihitung sebagai WIB.';
	if (!cta) errors.cta = 'Isi teks tombol.';
	else if (cta.length > PROMO_LIMITS.cta) errors.cta = `Teks tombol maksimal ${PROMO_LIMITS.cta} karakter.`;
	if (imageAlt.length > PROMO_LIMITS.imageAlt) errors.imageAlt = `Teks alternatif maksimal ${PROMO_LIMITS.imageAlt} karakter.`;
	return { promo, errors };
}
