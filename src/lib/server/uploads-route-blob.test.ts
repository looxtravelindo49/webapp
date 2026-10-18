import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Rute /uploads dengan penyimpanan Vercel Blob (klien Blob dipalsukan): memastikan nama tidak berpola
// tidak pernah sampai ke penyimpanan, dan isi disajikan langsung (bukan dialihkan ke domain Blob).
const blobGet = vi.fn();
vi.mock('@vercel/blob', async (importOriginal) => ({
	...(await importOriginal<typeof import('@vercel/blob')>()),
	get: (...args: unknown[]) => blobGet(...args)
}));

import { GET } from '../../routes/uploads/[name]/+server';

const ID = '0b6f3c1e-9d2a-4f7b-8c10-1a2b3c4d5e6f';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const original = { token: process.env.BLOB_READ_WRITE_TOKEN, dir: process.env.UPLOAD_DIR };

beforeEach(() => {
	blobGet.mockReset();
	process.env.BLOB_READ_WRITE_TOKEN = 'token-uji';
});
afterEach(() => {
	if (original.token === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
	else process.env.BLOB_READ_WRITE_TOKEN = original.token;
});

const call = async (name: string) => {
	try {
		return (await GET({ params: { name } } as unknown as Parameters<typeof GET>[0])) as Response;
	} catch (e) {
		return new Response(null, { status: (e as { status?: number }).status ?? 500 });
	}
};

describe('GET /uploads/[name] dengan Vercel Blob', () => {
	it('berkas ada: 200 berisi gambar (bukan pengalihan) dengan header pengaman, dibaca dari uploads/<nama>', async () => {
		blobGet.mockResolvedValue({ statusCode: 200, stream: new Blob([PNG as BlobPart]).stream(), headers: new Headers(), blob: {} });
		const res = await call(`${ID}.png`);
		expect(res.status).toBe(200);
		expect(res.headers.get('location')).toBeNull();
		expect(res.headers.get('content-type')).toBe('image/png');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
		expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; img-src 'self'");
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
		expect(blobGet).toHaveBeenCalledWith(`uploads/${ID}.png`, expect.objectContaining({ access: 'private', token: 'token-uji' }));
	});

	it('tidak ada di Blob → 404', async () => {
		blobGet.mockResolvedValue(null);
		expect((await call(`${ID}.png`)).status).toBe(404);
	});

	it.each(['../package.json', '..', 'foto.png', `${ID}.svg`, `${ID}.png/..`, `${ID.toUpperCase()}.png`, '', '%2e%2e%2fpackage.json'])(
		'nama %j → 404 dan penyimpanan tidak disentuh',
		async (name) => {
			expect((await call(name)).status).toBe(404);
			expect(blobGet).not.toHaveBeenCalled();
		}
	);
});
