import sharp from 'sharp';

/** Sisi terpanjang foto portfolio setelah diubah ukuran. */
export const PORTFOLIO_MAX_EDGE = 1600;
/** Ukuran berkas WebP yang disimpan. */
export const PORTFOLIO_MAX_BYTES = 300 * 1024;

/**
 * Ubah foto menjadi WebP. Sisi terpanjang paling banyak 1600px dan berkas di bawah 300 KB.
 * Melempar bila berkas bukan gambar yang dapat dibaca atau tetap terlalu besar.
 */
export async function compressToWebp(input: Uint8Array): Promise<Uint8Array> {
	let edge = PORTFOLIO_MAX_EDGE;
	for (let attempt = 0; attempt < 5; attempt++) {
		for (const quality of [82, 74, 66, 58, 50, 42]) {
			const out = await sharp(input, { failOn: 'error', animated: false })
				.rotate()
				.resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
				.webp({ quality, effort: 4 })
				.toBuffer();
			if (out.byteLength <= PORTFOLIO_MAX_BYTES) return new Uint8Array(out);
		}
		edge = Math.round(edge * 0.72);
	}
	throw new Error('Foto tetap lebih besar dari 300 KB setelah dikompresi.');
}
