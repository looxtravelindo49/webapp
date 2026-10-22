/**
 * Normalisasi nomor WhatsApp Indonesia: buang non-digit, awalan 0 → 62.
 * Mengembalikan null bila hasilnya bukan nomor valid (`^62[1-9]\d{7,12}$`).
 */
export function normalizeWhatsapp(input: string | null | undefined): string | null {
	let digits = String(input ?? '').replace(/\D/g, '');
	if (digits.startsWith('0')) digits = '62' + digits.slice(1);
	return /^62[1-9]\d{7,12}$/.test(digits) ? digits : null;
}

export const DEFAULT_WA_MESSAGE = 'Halo Lembang Adventure, saya ingin konsultasi trip.';

/** Nomor tombol chat mengambang. Tidak mengikuti pengaturan admin. */
export const FLOAT_WA_NUMBER = '6282120209900';

const ACTIVITY_LINE = 'Pilihan Activity: ';

/** Template untuk pengunjung yang tidak mengisi formulir konsultasi. */
export const FLOAT_WA_TEMPLATE = `Halooo LembangAdventure.com !
Saya mau konsultasi trip/outbound di Lembang.

Nama: 
Instansi/Perusahaan: 
${ACTIVITY_LINE}
Tanggal: 
Jumlah peserta: 

Budget per orang (opsional): 

Mohon info paket dan penawarannya ya, terima kasih!`;

/** Isi baris kegiatan dengan nama paket di halaman detail. */
export function floatWaMessage(packageTitle?: string | null): string {
	const name = packageTitle?.trim();
	if (!name) return FLOAT_WA_TEMPLATE;
	return FLOAT_WA_TEMPLATE.replace(ACTIVITY_LINE, `${ACTIVITY_LINE}${name}`);
}

/** `6282120209900` → `+62 821-2020-9900`. Nomor lain ditampilkan dengan awalan +. */
export function formatWhatsappDisplay(digits: string): string {
	const local = digits.startsWith('62') ? digits.slice(2) : digits;
	if (local.length === 11) return `+62 ${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
	return `+${digits}`;
}

export function waLink(number: string, text: string = DEFAULT_WA_MESSAGE): string {
	return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
