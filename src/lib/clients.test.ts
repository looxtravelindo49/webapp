import { describe, expect, it } from 'vitest';
import { clientsFromStored, DEFAULT_CLIENTS, planClients, type ClientLogo } from './clients';
import { seedSettings } from './server/seed';

const list = (): ClientLogo[] => DEFAULT_CLIENTS.map((client) => ({ ...client }));

describe('clientsFromStored', () => {
	it('memakai 11 klien awal bila pengaturan belum ada', () => {
		expect(clientsFromStored(null)).toEqual(list());
		expect(clientsFromStored('')).toEqual(list());
		expect(clientsFromStored('{')).toEqual(list());
		expect(clientsFromStored(seedSettings.clients)).toEqual(list());
	});

	it('menyimpan daftar kosong dan membuang path yang tidak aman', () => {
		expect(clientsFromStored('[]')).toEqual([]);
		const stored = clientsFromStored(
			JSON.stringify([
				{ id: 'mandiri', name: 'Mandiri', src: 'https://evil.example/a.svg' },
				{ id: 'sanbe', name: '  Sanbe   Farma ', src: null }
			])
		);
		expect(stored).toEqual([
			{ id: 'mandiri', name: 'Mandiri', src: null },
			{ id: 'sanbe', name: 'Sanbe Farma', src: null }
		]);
	});
});

describe('planClients', () => {
	const base = { ids: list().map((c) => c.id), names: list().map((c) => c.name), clearIds: [] as string[], newName: '' };

	it('mengganti nama dan mengosongkan logo', () => {
		const names = [...base.names];
		names[0] = 'Bank Mandiri';
		const plan = planClients(list(), { ...base, names, clearIds: ['sanbe', 'mandiri'], intent: { kind: 'save' } });
		expect(plan.ok).toBe(true);
		if (!plan.ok) return;
		expect(plan.clients[0]).toEqual({ id: 'mandiri', name: 'Bank Mandiri', src: null });
		expect(plan.clients.find((c) => c.id === 'pln')?.src).toBe('/media/clients/pln.svg');
		expect(plan.addName).toBeNull();
	});

	it('naik dan turun menukar urutan', () => {
		const down = planClients(list(), { ...base, intent: { kind: 'down', id: 'mandiri' } });
		expect(down.ok && down.clients.map((c) => c.id).slice(0, 2)).toEqual(['bni', 'mandiri']);
		const up = planClients(list(), { ...base, intent: { kind: 'up', id: 'bni' } });
		expect(up.ok && up.clients.map((c) => c.id).slice(0, 2)).toEqual(['bni', 'mandiri']);
	});

	it('menghapus satu klien dan menolak nama kosong', () => {
		const removed = planClients(list(), { ...base, intent: { kind: 'delete', id: 'pln' } });
		expect(removed.ok && removed.clients).toHaveLength(10);
		expect(removed.ok && removed.clients.some((c) => c.id === 'pln')).toBe(false);
		const names = [...base.names];
		names[2] = '   ';
		const bad = planClients(list(), { ...base, names, intent: { kind: 'save' } });
		expect(bad.ok).toBe(false);
		if (bad.ok) return;
		expect(bad.message).toBe('Isi nama setiap klien.');
	});

	it('tambah butuh nama dan tidak memakai id dari formulir', () => {
		const missing = planClients(list(), { ...base, intent: { kind: 'add' } });
		expect(missing.ok).toBe(false);
		const added = planClients(list(), { ...base, ids: [...base.ids, 'palsu'], names: [...base.names, 'Palsu'], intent: { kind: 'add' }, newName: 'Klien Baru' });
		expect(added.ok).toBe(true);
		if (!added.ok) return;
		expect(added.clients.some((c) => c.id === 'palsu')).toBe(false);
		expect(added.addName).toBe('Klien Baru');
		expect(added.clients).toHaveLength(11);
	});
});
