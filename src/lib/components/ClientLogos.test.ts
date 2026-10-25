import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ClientLogos from './ClientLogos.svelte';
import { CLIENTS } from '#lib/content/clients.js';

describe('Our Clients', () => {
	it('menaruh 11 klien, logo yang ada, dan wordmark untuk yang tidak', () => {
		const { body } = render(ClientLogos);
		expect(body).toContain('Our Clients');
		expect(body).toContain('id="klien"');
		expect(CLIENTS).toHaveLength(11);
		for (const client of CLIENTS) expect(body).toContain(client.name);
		expect(body).toContain('/media/clients/mandiri.svg');
		expect(body).toContain('/media/clients/pln.svg');
		expect(body.match(/src="\/media\/clients\/mandiri.svg"/g)).toHaveLength(2);
		expect(body).toContain('Sanbe Farma');
		expect(body).toContain('Syamil Quran');
		expect(body).not.toContain('/media/clients/sanbe');
		expect(body).toContain('clients-track');
		expect(body).toContain('clients-copy');
	});
});
