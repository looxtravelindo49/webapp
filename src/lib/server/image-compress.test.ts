import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressToWebp, PORTFOLIO_MAX_BYTES, PORTFOLIO_MAX_EDGE } from './image-compress';

describe('compressToWebp', () => {
	it('mengecilkan foto besar menjadi WebP di bawah 300 KB dan 1600 px', async () => {
		const raw = Buffer.alloc(2200 * 1400 * 3);
		for (let i = 0; i < raw.length; i += 97) raw[i] = (i * 13) % 256;
		const png = await sharp(raw, { raw: { width: 2200, height: 1400, channels: 3 } }).png().toBuffer();
		const out = await compressToWebp(new Uint8Array(png));
		const meta = await sharp(out).metadata();
		expect(meta.format).toBe('webp');
		expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(PORTFOLIO_MAX_EDGE);
		expect(out.byteLength).toBeLessThanOrEqual(PORTFOLIO_MAX_BYTES);
		expect(out.byteLength).toBeGreaterThan(100);
	});

	it('menolak berkas yang bukan gambar', async () => {
		await expect(compressToWebp(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
	});
});
