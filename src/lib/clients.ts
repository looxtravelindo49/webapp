import { optionalImage } from './images.js';

export const CLIENTS_SETTING_KEY = 'clients';
export const CLIENT_NAME_MAX = 60;
export const CLIENT_LIST_MAX = 40;

export type ClientLogo = {
	id: string;
	name: string;
	/** Kosong = wordmark teks abu-abu. */
	src: string | null;
};

/** Daftar awal. Path `/media/…` tidak dihapus saat logo diganti. */
export const DEFAULT_CLIENTS: readonly ClientLogo[] = [
	{ id: 'mandiri', name: 'Mandiri', src: '/media/clients/mandiri.svg' },
	{ id: 'bni', name: 'BNI', src: '/media/clients/bni.svg' },
	{ id: 'bsi', name: 'BSI', src: '/media/clients/bsi.svg' },
	{ id: 'telkom', name: 'Telkom', src: '/media/clients/telkom.svg' },
	{ id: 'pertamina', name: 'Pertamina', src: '/media/clients/pertamina.svg' },
	{ id: 'sanbe', name: 'Sanbe Farma', src: null },
	{ id: 'pgn', name: 'PGN', src: '/media/clients/pgn.svg' },
	{ id: 'heavenly', name: 'Heavenly Blush', src: '/media/clients/heavenly-blush.png' },
	{ id: 'syamil', name: 'Syamil Quran', src: null },
	{ id: 'daarut', name: 'Daarut Tauhid', src: '/media/clients/daarut-tauhid.png' },
	{ id: 'pln', name: 'PLN', src: '/media/clients/pln.svg' }
];

export type ClientIntent =
	| { kind: 'save' }
	| { kind: 'add' }
	| { kind: 'delete'; id: string }
	| { kind: 'up'; id: string }
	| { kind: 'down'; id: string };

export function normalizeClientName(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ');
}

export function parseClientIntent(raw: unknown): ClientIntent {
	const text = typeof raw === 'string' ? raw : '';
	if (text === 'add') return { kind: 'add' };
	const match = /^(up|down|delete):([a-z0-9-]{1,40})$/.exec(text);
	if (!match) return { kind: 'save' };
	const kind = match[1] as 'up' | 'down' | 'delete';
	return { kind, id: match[2] };
}

/** `null` atau JSON rusak memakai daftar awal. `[]` adalah daftar kosong yang disimpan admin. */
export function clientsFromStored(raw: string | null | undefined): ClientLogo[] {
	if (raw == null || raw.trim() === '') return DEFAULT_CLIENTS.map((client) => ({ ...client }));
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return DEFAULT_CLIENTS.map((client) => ({ ...client }));
	}
	if (!Array.isArray(data)) return DEFAULT_CLIENTS.map((client) => ({ ...client }));
	const clients: ClientLogo[] = [];
	const seen = new Set<string>();
	for (const item of data) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const id = typeof row.id === 'string' ? row.id : '';
		const name = typeof row.name === 'string' ? normalizeClientName(row.name) : '';
		if (!/^[a-z0-9-]{1,40}$/.test(id) || seen.has(id) || !name || name.length > CLIENT_NAME_MAX) continue;
		seen.add(id);
		clients.push({
			id,
			name,
			src: typeof row.src === 'string' ? optionalImage(row.src) : null
		});
	}
	return clients;
}

export function newClientId(existing: Iterable<string>): string {
	const taken = new Set(existing);
	for (let i = 0; i < 8; i++) {
		const bytes = new Uint8Array(4);
		crypto.getRandomValues(bytes);
		const id = `k${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
		if (!taken.has(id)) return id;
	}
	return `k${Date.now().toString(36)}`;
}

export type ClientPlanInput = {
	ids: string[];
	names: string[];
	clearIds: string[];
	intent: ClientIntent;
	newName: string;
};

export type ClientPlan =
	| { ok: true; clients: ClientLogo[]; replaceIds: string[]; addName: string | null }
	| { ok: false; message: string; clients: ClientLogo[]; newName: string };

function displayClients(current: readonly ClientLogo[], ids: string[], names: string[], clearIds: string[]): ClientLogo[] {
	const byId = new Map(current.map((client) => [client.id, client]));
	const clear = new Set(clearIds);
	const seen = new Set<string>();
	const rows: ClientLogo[] = [];
	for (let i = 0; i < ids.length; i++) {
		const existing = byId.get(ids[i] ?? '');
		if (!existing || seen.has(existing.id)) continue;
		seen.add(existing.id);
		rows.push({
			id: existing.id,
			name: normalizeClientName(names[i] ?? ''),
			src: clear.has(existing.id) ? null : existing.src
		});
	}
	for (const client of current) if (!seen.has(client.id)) rows.push({ ...client });
	return rows;
}

/** Rencana simpan tanpa menyentuh berkas. Id yang tidak ada di data tersimpan diabaikan. */
export function planClients(current: readonly ClientLogo[], input: ClientPlanInput): ClientPlan {
	const newName = normalizeClientName(input.newName);
	if (input.ids.length !== input.names.length) {
		return {
			ok: false,
			message: 'Formulir logo klien tidak lengkap. Muat ulang halaman, lalu coba lagi.',
			clients: current.map((client) => ({ ...client })),
			newName
		};
	}
	const clients = displayClients(current, input.ids, input.names, input.clearIds);
	const invalid = clients.find((client) => !client.name || client.name.length > CLIENT_NAME_MAX);
	if (invalid) {
		return {
			ok: false,
			message: invalid.name.length > CLIENT_NAME_MAX ? 'Nama klien terlalu panjang.' : 'Isi nama setiap klien.',
			clients,
			newName
		};
	}
	const intent = input.intent;
	if (intent.kind === 'delete') {
		const index = clients.findIndex((client) => client.id === intent.id);
		if (index >= 0) clients.splice(index, 1);
	} else if (intent.kind === 'up' || intent.kind === 'down') {
		const index = clients.findIndex((client) => client.id === intent.id);
		const swap = intent.kind === 'up' ? index - 1 : index + 1;
		if (index >= 0 && swap >= 0 && swap < clients.length) {
			const [row] = clients.splice(index, 1);
			clients.splice(swap, 0, row);
		}
	}
	let addName: string | null = null;
	if (input.intent.kind === 'add') {
		if (!newName) return { ok: false, message: 'Isi nama klien baru.', clients, newName: '' };
		if (newName.length > CLIENT_NAME_MAX) return { ok: false, message: 'Nama klien terlalu panjang.', clients, newName };
		if (clients.length >= CLIENT_LIST_MAX) return { ok: false, message: 'Maksimal 40 klien.', clients, newName };
		addName = newName;
	}
	return { ok: true, clients, replaceIds: clients.map((client) => client.id), addName };
}
