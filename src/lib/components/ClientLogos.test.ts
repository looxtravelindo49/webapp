import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ClientLogos from './ClientLogos.svelte';
import { DEFAULT_CLIENTS } from '#lib/clients.js';

describe('Our Clients', () => {
	it('desktop satu baris dan ponsel dua baris yang bersama-sama memuat 11 klien', () => {
		const { body } = render(ClientLogos, { props: { clients: DEFAULT_CLIENTS } });
		expect(body).toContain('Our Clients');
		expect(body).toContain('id="klien"');
		expect(body).toContain('clients-desktop');
		expect(body).toContain('clients-mobile');
		expect(DEFAULT_CLIENTS).toHaveLength(11);
		for (const client of DEFAULT_CLIENTS) expect(body).toContain(client.name);
		expect(body).toContain('--clients-visible: 6');
		expect(body).toContain('--clients-visible: 3');
		expect(body.match(/--clients-visible: 3/g)).toHaveLength(2);
		expect(body).toContain('--clients-shift: 50%');
		expect(body.match(/src="\/media\/clients\/mandiri.svg"/g)?.length).toBeGreaterThanOrEqual(4);
		const mobile = body.split('clients-mobile')[1] ?? '';
		expect(mobile).toContain('Sanbe Farma');
		expect(mobile).toContain('Syamil Quran');
		expect(mobile).toContain('/media/clients/mandiri.svg');
		expect(mobile).toContain('/media/clients/pln.svg');
		expect(body).not.toContain('/media/clients/sanbe');
	});

	it('menyembunyikan pita bila daftar kosong dan mengulang logo bila daftar pendek', () => {
		expect(render(ClientLogos, { props: { clients: [] } }).body).not.toContain('id="klien"');
		const { body } = render(ClientLogos, {
			props: { clients: [{ id: 'satu', name: 'Satu', src: '/media/clients/mandiri.svg' }] }
		});
		expect(body.match(/src="\/media\/clients\/mandiri.svg"/g)?.length).toBeGreaterThanOrEqual(12);
		expect(body).toContain('--clients-shift: 8.3333%');
		expect(body.match(/--clients-visible: 3/g)).toHaveLength(1);
	});
});