import { formatRupiah } from './format';

/**
 * Nama singkat untuk tombol "Add …".
 * Tiga kata atau lebih memakai kata pertama ("Offroad Land Rover" → "Offroad").
 */
export function packageShortName(title: string): string {
	const words = title.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return title.trim();
	return words.length >= 3 ? words[0] : words.join(' ');
}

/** "Rp249rb/orang" untuk ribuan bulat; "Rp1,75jt/orang" untuk jutaan. Selain itu format rupiah penuh. */
export function formatPriceTag(amount: number | null): string | null {
	if (amount === null || !Number.isInteger(amount) || amount < 0) return null;
	if (amount >= 1_000_000 && amount % 50_000 === 0) {
		const text = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(amount / 1_000_000);
		return `Rp${text}jt/orang`;
	}
	if (amount >= 1_000 && amount < 1_000_000 && amount % 1_000 === 0) return `Rp${amount / 1000}rb/orang`;
	return `${formatRupiah(amount)}/orang`;
}

export function visibleDuration(duration: string | null | undefined): string | null {
	const text = duration?.trim() ?? '';
	return text === '' ? null : text;
}

/** Deskripsi meta: ringkasan, atau kalimat pertama isi, dipotong di batas kata. */
export function packageMetaDescription(summary: string, body: string): string {
	const source = summary.trim() || body.trim().split('\n')[0] || '';
	const flat = source.replace(/\s+/g, ' ').trim();
	if (flat.length <= 160) return flat;
	const cut = flat.slice(0, 157);
	const word = cut.replace(/\s+\S*$/, '');
	return `${word.length > 40 ? word : cut.trim()}…`;
}
