/**
 * Jalankan inisialisasi saat start (boleh asinkron). Bila gagal, catat galatnya lalu hentikan
 * proses (exit code 1) agar orkestrator bisa me-restart, bukan membiarkan server menggantung.
 */
export async function initOrExit(
	init: () => unknown,
	exit: (code: number) => never = (code) => process.exit(code)
): Promise<void> {
	try {
		await init();
	} catch (err) {
		console.error('[db] gagal start:', err);
		exit(1);
	}
}
