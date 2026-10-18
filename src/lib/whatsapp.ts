/**
 * Normalisasi nomor WhatsApp Indonesia: buang non-digit, awalan 0 → 62.
 * Mengembalikan null bila hasilnya bukan nomor valid (`^62[1-9]\d{7,12}$`).
 */
export function normalizeWhatsapp(input: string | null | undefined): string | null {
	let digits = String(input ?? '').replace(/\D/g, '');
	if (digits.startsWith('0')) digits = '62' + digits.slice(1);
	return /^62[1-9]\d{7,12}$/.test(digits) ? digits : null;
}

export const DEFAULT_WA_MESSAGE = 'Halo Lembang Adventures, saya ingin konsultasi trip.';

export function waLink(number: string, text: string = DEFAULT_WA_MESSAGE): string {
	return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
