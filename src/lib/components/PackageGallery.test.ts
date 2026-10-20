import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PackageGallery from './PackageGallery.svelte';

const slides = [
	{ src: '/media/forest.svg', alt: 'Satu' },
	{ src: '/media/camp.svg', alt: 'Dua' },
	{ src: '/media/river.svg', alt: 'Tiga' },
	{ src: '/media/paintball.svg', alt: null }
];

const html = (photos: { src: string; alt: string | null }[]) =>
	render(PackageGallery, { props: { photos, fallbackAlt: 'Jeep di hutan pinus' } }).body;

describe('PackageGallery', () => {
	it('empat foto: satu besar di atas dan tiga thumbnail di bawah', () => {
		const body = html(slides);
		expect(body).toContain('alt="Satu"');
		expect(body).toContain('loading="eager"');
		expect(body.match(/loading="lazy"/g)).toHaveLength(3);
		expect(body).toContain('src="/media/camp.svg"');
		expect(body).toContain('src="/media/river.svg"');
		expect(body).toContain('src="/media/paintball.svg"');
		expect(body).toContain('aria-label="Tampilkan Dua"');
		expect(body).toContain('aria-label="Tampilkan Tiga"');
		expect(body).toContain('aria-label="Tampilkan Jeep di hutan pinus"');
		expect(body).toContain('alt="Dua"');
		expect(body).toContain('alt="Tiga"');
		expect(body).toContain('alt="Jeep di hutan pinus"');
		expect(body).not.toContain('alt=""');
		expect(body).toContain('data-autoplay-ms="4000"');
	});

	it('panel tidak aktif kembali ke foto pertama dan tidak menggeser', () => {
		const body = render(PackageGallery, { props: { photos: slides, fallbackAlt: 'Jeep di hutan pinus', running: false } }).body;
		expect(body).toContain('alt="Satu"');
		expect(body).toContain('alt="Dua"');
		expect(body).not.toContain('data-autoplay-ms');
	});

	it('tanpa geser: pan horizontal tidak dikunci, geser otomatis tetap', () => {
		const body = render(PackageGallery, {
			props: { photos: slides, fallbackAlt: 'Jeep di hutan pinus', swipe: false }
		}).body;
		expect(body).not.toContain('touch-pan-y');
		expect(body).toContain('data-autoplay-ms="4000"');
		expect(body).toContain('aria-label="Tampilkan Dua"');
	});

	it('satu foto: tanpa thumbnail dan tanpa geser otomatis', () => {
		const body = html([slides[0]]);
		expect(body).toContain('alt="Satu"');
		expect(body).toContain('loading="eager"');
		expect(body).not.toContain('loading="lazy"');
		expect(body).not.toContain('data-autoplay-ms');
		expect(body).not.toContain('Tampilkan');
	});
});
