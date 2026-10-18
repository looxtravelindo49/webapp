// Berkas contoh untuk tes unggah. Hanya byte awal (magic) yang penting bagi server;
// PNG dan WebP di bawah juga gambar 1x1 yang valid sehingga bisa dirender peramban.

export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
export const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0', 'latin1'), Buffer.alloc(32)]);
// Kotak ftyp: ukuran 24, 'ftyp', brand utama 'avif', versi 0, brand kompatibel 'avif' 'mif1'.
export const AVIF = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypavif', 'latin1'), Buffer.alloc(4), Buffer.from('avifmif1', 'latin1'), Buffer.alloc(16)]);
export const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>');
export const GIF = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1');
export const TEXT = Buffer.from('ini bukan gambar, hanya teks biasa');

export const MB = 1024 * 1024;
/** PNG berukuran tepat `bytes` (magic PNG + isi nol). */
export function pngOfSize(bytes: number): Buffer {
	const out = Buffer.alloc(bytes);
	PNG.copy(out, 0, 0, Math.min(PNG.length, bytes));
	return out;
}

export const file = (name: string, buffer: Buffer, mimeType = 'application/octet-stream') => ({ name, mimeType, buffer });
