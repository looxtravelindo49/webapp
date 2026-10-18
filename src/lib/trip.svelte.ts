import { getContext, setContext } from 'svelte';

/**
 * State trip yang dibagi antara section Paket dan kalkulator. Dibuat per render lewat context
 * (bukan singleton modul) agar tidak terbagi antar request di server.
 */
export class TripState {
	/** Slug paket terpilih, urut sesuai waktu dipilih. */
	selected = $state<string[]>([]);
	team = $state('');
	/** Jumlah peserta mentah (string) agar kesalahan ketik bisa ditampilkan apa adanya. */
	pax = $state('');
	/** yyyy-mm-dd atau kosong. */
	date = $state('');
	notes = $state('');

	has(slug: string): boolean {
		return this.selected.includes(slug);
	}

	toggle(slug: string): void {
		this.selected = this.has(slug) ? this.selected.filter((s) => s !== slug) : [...this.selected, slug];
	}
}

const KEY = Symbol('trip');

export function setTripContext(): TripState {
	return setContext(KEY, new TripState());
}

export function getTripContext(): TripState {
	return getContext<TripState>(KEY);
}
