const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** 250000 → "Rp 250.000" */
export function formatRupiah(amount: number): string {
	return 'Rp ' + rupiah.format(amount);
}

const longDate = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' });
const dateTime = new Intl.DateTimeFormat('id-ID', {
	dateStyle: 'medium',
	timeStyle: 'short',
	timeZone: 'Asia/Jakarta'
});

/** "2026-09-15T00:00:00.000Z" → "15 September 2026" (zona WIB); kosong atau tidak valid → "". */
export function formatDate(iso: string | null | undefined): string {
	const d = iso ? new Date(iso) : null;
	return d && !Number.isNaN(d.getTime()) ? longDate.format(d) : '';
}

/** Waktu singkat WIB untuk daftar admin. Kosong atau tidak valid → "". */
export function formatDateTime(iso: string | null | undefined): string {
	const d = iso ? new Date(iso) : null;
	return d && !Number.isNaN(d.getTime()) ? dateTime.format(d) : '';
}
