const rupiah = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** 250000 → "Rp 250.000" */
export function formatRupiah(amount: number): string {
	return 'Rp ' + rupiah.format(amount);
}
