import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ClientLogos from './ClientLogos.svelte';
import { DEFAULT_CLIENTS } from '#lib/clients.js';

describe('Our Clients', () => {
	it('menaruh 11 klien, logo yang ada, dan wordmark untuk yang tidak', () => {
		const { body } = render(ClientLogos, { props: { clients: DEFAULT_CLIENTS } });
		expect(body).toContain('Our Clients');
		expect(body).toContain('id="klien"');
		expect(DEFAULT_CLIENTS).toHaveLength(11);
		for (const client of DEFAULT_CLIENTS) expect(body).toContain(client.name);
		expect(body).toContain('/media/clients/mandiri.svg');
		expect(body).toContain('/media/clients/pln.svg');
		expect(body.match(/src="\/media\/clients\/mandiri.svg"/g)).toHaveLength(2);
		expect(body).toContain('--clients-shift: 50%');
		expect(body).toContain('Sanbe Farma');
		expect(body).toContain('Syamil Quran');
		expect(body).not.toContain('/media/clients/sanbe');
		expect(body).toContain('clients-track');
		expect(body).toContain('clients-copy');
	});

	it('menyembunyikan pita bila daftar kosong dan mengulang logo bila daftar pendek', () => {
		expect(render(ClientLogos, { props: { clients: [] } }).body).not.toContain('id="klien"');
		const { body } = render(ClientLogos, {
			props: { clients: [{ id: 'satu', name: 'Satu', src: '/media/clients/mandiri.svg' }] }
		});
		expect(body.match(/src="\/media\/clients\/mandiri.svg"/g)).toHaveLength(12);
		expect(body).toContain('--clients-shift: 8.3333%');
	});
});
