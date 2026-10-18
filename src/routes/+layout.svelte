<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Penanda hidrasi: dipakai tes e2e (e2e/support/fixtures.ts) untuk menunggu halaman benar-benar
	// interaktif. Tidak ada efek visual; jangan dihapus tanpa memperbarui tes.
	onMount(() => {
		document.documentElement.dataset.hydrated = 'true';
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
