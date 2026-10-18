import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GET } from '../../routes/uploads/[name]/+server';
import { detectImageType, saveImage } from './uploads';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
let dir = '';
const original = process.env.UPLOAD_DIR;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'lembang-route-'));
	process.env.UPLOAD_DIR = dir;
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
	if (original === undefined) delete process.env.UPLOAD_DIR;
	else process.env.UPLOAD_DIR = original;
});

// Handler ini sinkron (readFileSync); tipe bawaan SvelteKit adalah MaybePromise<Response>.
const get = (name: string) => GET({ params: { name } } as unknown as Parameters<typeof GET>[0]) as Response;
const status = (name: string) => {
	try {
		get(name);
		return 200;
	} catch (e) {
		return (e as { status?: number }).status ?? 500;
	}
};

describe('GET /uploads/[name]', () => {
	it('berkas ada: 200 dengan tipe, isi, dan header pengaman', async () => {
		const path = saveImage(PNG, detectImageType(PNG)!, dir);
		const res = get(path.replace('/uploads/', ''));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/png');
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
		expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; img-src 'self'");
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
	});

	it('berpola benar tetapi tidak ada di disk → 404', () => {
		expect(status('0b6f3c1e-9d2a-4f7b-8c10-1a2b3c4d5e6f.png')).toBe(404);
	});

	it.each([
		'../package.json',
		'..',
		'foto.png',
		'0b6f3c1e-9d2a-4f7b-8c10-1a2b3c4d5e6f.svg',
		'0b6f3c1e-9d2a-4f7b-8c10-1a2b3c4d5e6f.png/..',
		'0B6F3C1E-9D2A-4F7B-8C10-1A2B3C4D5E6F.png',
		'',
		'%2e%2e%2fpackage.json'
	])('nama %j → 404', (name) => expect(status(name)).toBe(404));

	it('berkas lain di folder yang sama (bukan berpola) tidak pernah tersaji', () => {
		writeFileSync(join(dir, 'rahasia.png'), 'x');
		writeFileSync(join(dir, 'x.svg'), '<svg onload=alert(1)>');
		expect(status('rahasia.png')).toBe(404);
		expect(status('x.svg')).toBe(404);
	});

	it('setiap ekstensi mendapat Content-Type yang sesuai', () => {
		const cases: [Uint8Array, string][] = [
			[new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]), 'image/jpeg'],
			[new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [...'WEBP'].map((c) => c.charCodeAt(0)))), 'image/webp']
		];
		for (const [bytes, mime] of cases) {
			const path = saveImage(bytes, detectImageType(bytes)!, dir);
			expect(get(path.replace('/uploads/', '')).headers.get('content-type')).toBe(mime);
		}
	});
});
