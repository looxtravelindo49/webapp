export type ClientLogo = {
	id: string;
	name: string;
	/** Kosong = wordmark teks, bila berkas logo resmi tidak didapat. */
	src: string | null;
};

/**
 * Logo dari Wikimedia Commons (domain publik) atau situs resmi.
 * Sanbe Farma dan Syamil Quran tidak punya berkas logo yang bisa diunduh dengan pasti, jadi wordmark.
 */
export const CLIENTS: readonly ClientLogo[] = [
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
