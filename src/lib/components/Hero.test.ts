import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { HERO_DESKTOP_MEDIA, HERO_MOBILE_MEDIA, hero } from '#lib/content/hero.js';
import { FLOAT_WA_NUMBER, FLOAT_WA_TEMPLATE, waLink } from '#lib/whatsapp.js';
import Hero from './Hero.svelte';

const view = () => render(Hero);

describe('Hero', () => {
	it('satu H1, chip, janji, dan dua tombol sesuai mockup', () => {
		const { body, head } = view();
		expect(body.match(/<h1\b/g)).toHaveLength(1);
		expect(body).toContain('Bawa timmu');
		expect(body).toContain('keluar dari');
		expect(body).toContain('rutinitas.');
		expect(body).not.toContain('MOCKUP');
		expect(body).not.toContain('belum diterapkan');
		for (const chip of hero.chips) expect(body).toContain(chip);
		for (const item of hero.promise) expect(body).toContain(item);
		expect(body).toContain(`href="${hero.primaryCta.href}"`);
		expect(body).toContain(hero.primaryCta.label);
		expect(body).toContain(hero.chatCta.label);
		expect(body).toContain(`href="${waLink(FLOAT_WA_NUMBER, FLOAT_WA_TEMPLATE)}"`);
		expect(body).toContain(`alt="${hero.imageAlt}"`);
		expect(body).toContain(`width="${hero.imageWidth}"`);
		expect(body).toContain(`height="${hero.imageHeight}"`);
		expect(body).toContain('fetchpriority="high"');
		expect(body).toContain('decoding="async"');
		expect(body).not.toContain('loading="lazy"');
		expect(body).toContain(`media="${HERO_MOBILE_MEDIA}"`);
		expect(body).toContain(hero.mobileImage);
		expect(body).toContain(hero.desktopImage);
		expect(head).toContain('rel="preload"');
		expect(head).toContain('as="image"');
		expect(head).toContain(`media="${HERO_DESKTOP_MEDIA}"`);
		expect(head).toContain(`media="${HERO_MOBILE_MEDIA}"`);
	});

	it('berkas webp desktop dan potret ada', () => {
		for (const path of [hero.desktopImage, hero.mobileImage]) {
			const bytes = readFileSync(new URL(`../../../static${path}`, import.meta.url));
			expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
			expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
		}
	});
});
