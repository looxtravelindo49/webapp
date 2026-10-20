<script lang="ts">
	// Hanya untuk tes: memasang context trip dan merangkai slider paket + kalkulator seperti di beranda.
	import { untrack } from 'svelte';
	import { setTripContext } from '#lib/trip.svelte.js';
	import type { Package } from '#lib/types.js';
	import PackageTabs from '../PackageTabs.svelte';
	import TripCalculator from '../TripCalculator.svelte';
	import TripToggle from '../TripToggle.svelte';

	let {
		packages,
		waNumber = null,
		selected = [],
		team = '',
		pax = '',
		date = '',
		notes = '',
		whatsapp = ''
	}: {
		packages: Package[];
		waNumber?: string | null;
		selected?: string[];
		team?: string;
		pax?: string;
		date?: string;
		notes?: string;
		whatsapp?: string;
	} = $props();

	const trip = setTripContext();
	untrack(() => {
		trip.selected = [...selected];
		trip.team = team;
		trip.pax = pax;
		trip.date = date;
		trip.notes = notes;
		trip.whatsapp = whatsapp;
	});
</script>

<PackageTabs {packages}>
	{#snippet action(p)}<TripToggle pkg={p} />{/snippet}
</PackageTabs>
<TripCalculator {packages} {waNumber} />
