import { getContext, setContext } from 'svelte';
import { ADDONS, isAddonId, normalizeAddonIds, type AddonId } from './addons';

/**
 * State trip yang dibagi antara section Paket dan kalkulator. Dibuat per render lewat context
 * (bukan singleton modul) agar tidak terbagi antar request di server.
 */
export class TripState {
	/** Slug paket terpilih, urut sesuai waktu dipilih. */
	selected = $state<string[]>([]);
	/** Id tambahan kalkulator. Bukan paket. */
	addons = $state<AddonId[]>([]);
	team = $state('');
	/** Nomor WhatsApp pengisi (mentah, opsional). */
	whatsapp = $state('');
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

	hasAddon(id: string): boolean {
		return this.addons.includes(id as AddonId);
	}

	/** Centang tambahan. Dokumentasi Basic dan Pro saling menggantikan. */
	toggleAddon(id: string): void {
		if (!isAddonId(id)) return;
		const addon = ADDONS.find((item) => item.id === id)!;
		const next = new Set(this.addons);
		if (next.has(id)) next.delete(id);
		else {
			if (addon.group) {
				for (const other of ADDONS) if (other.group === addon.group) next.delete(other.id);
			}
			next.add(id);
		}
		this.addons = normalizeAddonIds(next);
	}
}

const KEY = Symbol('trip');

export function setTripContext(): TripState {
	return setContext(KEY, new TripState());
}

export function getTripContext(): TripState {
	return getContext<TripState>(KEY);
}
