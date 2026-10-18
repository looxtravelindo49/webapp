<script lang="ts">
	import { getTripContext } from '#lib/trip.svelte.js';
	import type { Package } from '#lib/types.js';
	import Button from './Button.svelte';

	let { pkg }: { pkg: Package } = $props();

	const trip = getTripContext();
	const on = $derived(trip.has(pkg.slug));
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
	<Button variant={on ? 'outline' : 'primary'} aria-pressed={on} onclick={() => trip.toggle(pkg.slug)}>
		{on ? 'Hapus dari trip' : 'Tambah ke trip'}
	</Button>
	{#if on}
		<span class="text-[11px] text-muted">
			Sudah ada di trip kamu. <a href="#konsultasi" class="font-bold underline">Lihat estimasi</a>
		</span>
	{/if}
</div>
