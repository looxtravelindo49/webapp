import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PackageLinks from './PackageLinks.svelte';

describe('PackageLinks', () => {
	it('tidak merender apa pun bila daftar kosong', () => {
		const { body } = render(PackageLinks, { props: { heading: 'Paket lain', packages: [] } });
		expect(body).not.toContain('<nav');
		expect(body).not.toContain('Paket lain');
	});

	it('merender judul section dan tautan berteks judul paket', () => {
		const { body } = render(PackageLinks, {
			props: {
				heading: 'Pilihan paket',
				packages: [
					{ slug: 'offroad', title: 'Offroad' },
					{ slug: 'team-building', title: 'Team Building' }
				]
			}
		});
		expect(body).toContain('Pilihan paket');
		expect(body).toMatch(/<a href="\/paket\/offroad"[^>]*>Offroad<\/a>/);
		expect(body).toMatch(/<a href="\/paket\/team-building"[^>]*>Team Building<\/a>/);
		expect(body.match(/<a /g)).toHaveLength(2);
	});

	it('teks pengguna di-escape', () => {
		const { body } = render(PackageLinks, {
			props: { heading: 'Paket lain', packages: [{ slug: 'x', title: '<script>alert(1)</script>' }] }
		});
		expect(body).not.toContain('<script>alert(1)');
	});
});
