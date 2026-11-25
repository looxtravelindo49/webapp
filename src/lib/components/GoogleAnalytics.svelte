<script lang="ts">
	import { onMount } from 'svelte';
	import { isTrackedPath } from '#lib/analytics.js';

	/** Measurement ID GA4 yang sudah divalidasi (`gaMeasurementId`). */
	let { id }: { id: string } = $props();

	// Dipasang sekali setelah hidrasi. Navigasi antarhalaman SvelteKit tercatat otomatis oleh
	// enhanced measurement GA4 ("page changes based on browser history events").
	onMount(() => {
		if (!isTrackedPath(location.pathname)) return;
		const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void };
		w.dataLayer = w.dataLayer || [];
		w.gtag = function () {
			// gtag.js membutuhkan objek `arguments`, bukan array.
			// eslint-disable-next-line prefer-rest-params
			w.dataLayer.push(arguments);
		};
		w.gtag('js', new Date());
		w.gtag('config', id);
		const script = document.createElement('script');
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
		document.head.appendChild(script);
	});
</script>
