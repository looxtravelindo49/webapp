/**
 * Apakah peramban dapat membagikan berkas PDF lewat Web Share? Diperiksa sinkron dengan
 * berkas dummy supaya izin klik (user activation) belum terpakai saat PDF dibuat.
 */
export function canShareFile(): boolean {
	try {
		if (typeof navigator === 'undefined') return false;
		if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') return false;
		return navigator.canShare({ files: [new File([''], 'estimasi.pdf', { type: 'application/pdf' })] });
	} catch {
		return false;
	}
}

export type ShareResult = 'shared' | 'aborted' | 'failed';

/** Bagikan PDF + teks. `aborted` = pengguna membatalkan (jangan jalankan cadangan). */
export async function sharePdf(file: File, text: string): Promise<ShareResult> {
	try {
		await navigator.share({ files: [file], text });
		return 'shared';
	} catch (err) {
		return (err as { name?: string } | null)?.name === 'AbortError' ? 'aborted' : 'failed';
	}
}

/** Unduh Blob sebagai berkas. */
export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
