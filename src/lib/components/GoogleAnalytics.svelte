<script lang="ts">
	import { onMount } from 'svelte';
	import { isTrackedPath, trackEvent, WHATSAPP_EVENT, whatsappClickParams } from '#lib/analytics.js';

	/** Measurement ID GA4 yang sudah divalidasi (`gaMeasurementId`). */
	let { id, packageTitle = null }: { id: string; packageTitle?: string | null } = $props();

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

		// Semua tautan WhatsApp di situs → event `whatsapp_click`. Asal tombol dari atribut `data-wa`
		// terdekat. Tombol kalkulator trip membuka WhatsApp lewat skrip, jadi melapor sendiri.
		function onClick(event: MouseEvent) {
			const link = (event.target as Element | null)?.closest?.('a[href]');
			if (!(link instanceof HTMLAnchorElement) || !isTrackedPath(location.pathname)) return;
			const placement = link.closest<HTMLElement>('[data-wa]')?.dataset.wa;
			const params = whatsappClickParams(link.href, placement, packageTitle);
			if (params) trackEvent(WHATSAPP_EVENT, params);
		}
		document.addEventListener('click', onClick, { capture: true, passive: true });
		return () => document.removeEventListener('click', onClick, { capture: true });
	});
</script>
