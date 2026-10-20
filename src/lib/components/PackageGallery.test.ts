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
		expect(body).toContain('alt=""');
		expect(body).toContain('data-autoplay-ms="4000"');
		expect(body).not.toContain('src="/media/forest.svg" alt=""');
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
