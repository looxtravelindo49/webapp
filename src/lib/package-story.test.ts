import { describe, expect, it } from 'vitest';
import { packageStory } from './package-story';

const base = {
	price_per_person: 125_000,
	min_pax: 10,
	duration: null as string | null,
	kapasitas_per_unit: null as number | null,
	nama_unit: null as string | null
};

describe('packageStory', () => {
	it('menulis offroad dari kapasitas mobil dan harga paket', () => {
		const story = packageStory({
			...base,
			slug: 'offroad',
			price_per_person: 249_000,
			min_pax: 7,
			duration: '2-3 Jam',
			kapasitas_per_unit: 7,
			nama_unit: 'mobil'
		});
		expect(story?.paragraphs.join(' ')).toContain('Offroad di Cikole, Lembang, Bandung');
		expect(story?.paragraphs.join(' ')).toContain('maksimal 7 orang');
		expect(story?.paragraphs.join(' ')).toContain('Rp 249.000 per mobil');
		expect(story?.paragraphs.join(' ')).toContain('Minimal 7 peserta');
		expect(story?.paragraphs.join(' ')).toContain('2-3 Jam');
		expect(story?.includes).toEqual(['Mobil offroad, maksimal 7 orang per mobil']);
		expect(story?.excludes).toEqual([]);
	});

	it('paintball menyebut 40 peluru; rafting memakai fasilitas yang sudah tertulis', () => {
		const paintball = packageStory({ ...base, slug: 'paintball', price_per_person: 125_000, min_pax: 10 });
		expect(paintball?.paragraphs.join(' ')).toContain('40 peluru per orang');
		expect(paintball?.includes).toContain('Isi 40 peluru per orang');
		expect(paintball?.excludes).toEqual([]);

		const rafting = packageStory({ ...base, slug: 'rafting', price_per_person: 125_000, min_pax: 5 });
		expect(rafting?.paragraphs.join(' ')).toContain('Lokasi sungai mengikuti konsultasi');
		expect(rafting?.includes).toEqual([
			'Perahu, dayung, dan perlengkapan keselamatan',
			'Pemandu berpengalaman',
			'Briefing sebelum mulai'
		]);
		expect(rafting?.excludes).toEqual([]);
	});

	it('team building dan fun games tidak menambah fasilitas yang belum pasti', () => {
		const team = packageStory({ ...base, slug: 'team-building', price_per_person: 125_000, min_pax: 20 });
		expect(team?.paragraphs.join(' ')).toContain('komunikasi, kerja sama, dan kebersamaan');
		expect(team?.includes).toEqual([]);
		expect(team?.excludes).toEqual([]);

		const games = packageStory({ ...base, slug: 'fun-games', price_per_person: 80_000, min_pax: 20 });
		expect(games?.paragraphs.join(' ')).toContain('program yang disepakati');
		expect(games?.includes).toEqual([]);
		expect(games?.excludes).toEqual([]);
	});

	it('tidak menulis termurah dan tidak mengarang paket lain', () => {
		for (const slug of ['offroad', 'team-building', 'rafting', 'paintball', 'fun-games']) {
			const story = packageStory({ ...base, slug });
			const text = `${story?.paragraphs.join(' ')} ${story?.includes.join(' ')} ${story?.excludes.join(' ')}`.toLowerCase();
			expect(text).not.toContain('termurah');
			expect(text).not.toContain('dapat dibahas');
		}
		expect(packageStory({ ...base, slug: 'flying-fox' })).toBeNull();
	});
});