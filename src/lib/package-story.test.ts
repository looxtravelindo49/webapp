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
	it('menulis offroad dari fakta pemilik dan harga paket', () => {
		const story = packageStory({
			...base,
			slug: 'offroad',
			price_per_person: 249_000,
			min_pax: 7,
			duration: '2-3 Jam',
			kapasitas_per_unit: 7,
			nama_unit: 'mobil'
		});
		const text = story?.paragraphs.join(' ') ?? '';
		expect(text).toContain('Offroad di Cikole, Lembang, Bandung');
		expect(text).toContain('Titik kumpul Cikole, bisa juga start dari hotel area Lembang');
		expect(text).toContain('Maksimal 7 orang per mobil');
		expect(text).toContain('Rp 249.000 per mobil');
		expect(text).toContain('Minimal 7 peserta');
		expect(text).not.toContain('2-3 Jam');
		expect(story?.includes).toEqual([
			'Durasi 1–3 jam',
			'Land Rover',
			'Supir berpengalaman',
			'Tiket masuk Cikole',
			'Air mineral',
			'P3K',
			'Asuransi',
			'Coffee break'
		]);
		expect(story?.excludes).toEqual(['Transport', 'Makan', 'Dokumentasi']);
		expect(text).toContain('Dokumentasi dan makan siang Liwet');
	});

	it('paintball dan rafting memakai daftar yang dikonfirmasi', () => {
		const paintball = packageStory({ ...base, slug: 'paintball', price_per_person: 125_000, min_pax: 10 });
		expect(paintball?.paragraphs.join(' ')).toContain('Titik kumpul kegiatan di Cikole');
		expect(paintball?.paragraphs.join(' ')).toContain('40 peluru');
		expect(paintball?.includes).toEqual(['Pemandu', '40 peluru', 'Perlengkapan paintball', 'Area bermain']);
		expect(paintball?.excludes).toEqual(['Transport', 'Makan', 'Dokumentasi']);

		const rafting = packageStory({ ...base, slug: 'rafting', price_per_person: 125_000, min_pax: 5 });
		const raftingText = rafting?.paragraphs.join(' ') ?? '';
		expect(raftingText).toContain('Rafting di Ciater, Lembang, Bandung');
		expect(raftingText).toContain('Titik kumpul kegiatan di Cikole');
		expect(raftingText).not.toContain('perahu');
		expect(raftingText).not.toContain('Briefing');
		expect(rafting?.includes).toEqual(['Lokasi Ciater', 'Peralatan rafting', 'Pemandu', 'Durasi 20–30 menit']);
		expect(rafting?.excludes).toEqual(['Transport', 'Makan', 'Dokumentasi']);
	});

	it('team building dan fun games memakai catatan lokasi pemilik', () => {
		const team = packageStory({ ...base, slug: 'team-building', price_per_person: 125_000, min_pax: 20 });
		expect(team?.paragraphs.join(' ')).toContain('Bisa request di villa/hotel tempat menginap');
		expect(team?.includes).toEqual([
			'Game master',
			'Fasilitator',
			'Sound system',
			'Area',
			'Beragam jenis permainan untuk membangun kekompakan'
		]);
		expect(team?.excludes).toEqual(['Transport', 'Makan', 'Dokumentasi']);

		const games = packageStory({ ...base, slug: 'fun-games', price_per_person: 80_000, min_pax: 20 });
		expect(games?.paragraphs.join(' ')).toContain('Bisa request dilakukan di villa/hotel tempat menginap');
		expect(games?.includes).toEqual(['Pemandu', 'Sound system']);
		expect(games?.excludes).toEqual(['Transport', 'Makan', 'Dokumentasi']);
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