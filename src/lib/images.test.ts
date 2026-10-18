import { describe, expect, it } from 'vitest';
import { coverImage, creditLinks, FALLBACK_IMAGE, isUnsplashImage, safeImage, unsplashSized } from './images';

const RAW = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8&utm_source=x';

describe('isUnsplashImage', () => {
	it('hanya https://images.unsplash.com', () => {
		expect(isUnsplashImage(RAW)).toBe(true);
		for (const bad of [
			null, undefined, '', '/uploads/a.png', 'http://images.unsplash.com/a', 'https://images.unsplash.com.evil.com/a',
			'https://evil.com/images.unsplash.com/a', 'https://user:pw@images.unsplash.com/a', 'https://images.unsplash.com:8443/a',
			'javascript:alert(1)', 'data:image/png;base64,AAAA', 'bukan url'
		]) {
			expect(isUnsplashImage(bad as string), String(bad)).toBe(false);
		}
	});
});

describe('unsplashSized', () => {
	it('menambah w, h, fit, q, auto dan mempertahankan parameter asli termasuk ixid', () => {
		const u = new URL(unsplashSized(RAW, { w: 1200, h: 630 })!);
		expect(u.origin + u.pathname).toBe('https://images.unsplash.com/photo-1500648767791-00dcc994a43e');
		expect(Object.fromEntries(u.searchParams)).toMatchObject({
			ixlib: 'rb-4.1.0', ixid: 'M3wxMjA3fDB8MXxzZWFyY2h8MXx8', w: '1200', h: '630', fit: 'crop', q: '80', auto: 'format'
		});
	});
	it('mengganti ukuran yang sudah ada alih-alih menggandakan', () => {
		const once = unsplashSized(RAW, { w: 600, h: 338 })!;
		const twice = new URL(unsplashSized(once, { w: 1200, h: 675 })!);
		expect(twice.searchParams.getAll('w')).toEqual(['1200']);
		expect(twice.searchParams.getAll('h')).toEqual(['675']);
	});
	it('bukan URL Unsplash → null', () => {
		expect(unsplashSized('https://evil.com/a.jpg', { w: 1, h: 1 })).toBeNull();
		expect(unsplashSized(null, { w: 1, h: 1 })).toBeNull();
	});
});

describe('coverImage', () => {
	const size = { w: 600, h: 338 };
	it('Unsplash → URL berukuran', () => expect(coverImage(RAW, size)).toContain('w=600'));
	it('unggahan dan bawaan → path lokal', () => {
		expect(coverImage('/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c.png', size)).toBe('/uploads/0b5e1c3a-7d2f-4a8e-9c1b-2f3d4e5a6b7c.png');
		expect(coverImage('/media/camp.svg', size)).toBe('/media/camp.svg');
	});
	it('URL asing, kosong → gambar bawaan', () => {
		expect(coverImage('https://evil.com/a.jpg', size)).toBe(FALLBACK_IMAGE);
		expect(coverImage(null, size)).toBe(FALLBACK_IMAGE);
	});
	it('safeImage tetap menolak URL eksternal', () => expect(safeImage(RAW)).toBe(FALLBACK_IMAGE));
});

describe('creditLinks', () => {
	it('profil dan beranda Unsplash ber-UTM', () => {
		const l = creditLinks({ name: 'Ana', url: 'https://unsplash.com/@ana_b' }, 'lembang_adventures');
		expect(l.profile).toBe('https://unsplash.com/@ana_b?utm_source=lembang_adventures&utm_medium=referral');
		expect(l.unsplash).toBe('https://unsplash.com/?utm_source=lembang_adventures&utm_medium=referral');
		expect(l.name).toBe('Ana');
	});
	it.each([null, '', 'https://evil.com/@ana', 'http://unsplash.com/@ana', 'https://unsplash.com/photos/abc', 'javascript:alert(1)', 'https://unsplash.com/@a/b'])(
		'profil tidak valid %j → tanpa tautan',
		(url) => expect(creditLinks({ name: 'Ana', url }, 'app').profile).toBeNull()
	);
	it('nama aplikasi di-encode', () => {
		expect(creditLinks({ name: 'A', url: 'https://unsplash.com/@a' }, 'app baru&x').profile).toContain('utm_source=app+baru%26x');
	});
});
