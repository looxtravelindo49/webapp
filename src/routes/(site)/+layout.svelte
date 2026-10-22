<script lang="ts">
	import { site } from '#lib/content/site.js';
	import Footer from '#lib/components/Footer.svelte';
	import Navbar from '#lib/components/Navbar.svelte';
	import WhatsAppFloat from '#lib/components/WhatsAppFloat.svelte';
	import { jsonLdGraph, serializeJsonLd, travelAgencyNode } from '#lib/seo.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const businessLd = $derived(serializeJsonLd(jsonLdGraph([travelAgencyNode(data.siteUrl)])));
</script>

<svelte:head>
	<link rel="alternate" type="application/rss+xml" title="Artikel {site.name}" href="{data.siteUrl}/artikel/rss.xml" />
	{@html `<script type="application/ld+json">${businessLd}</script>`}
</svelte:head>

<a
	href="#main"
	class="print-hide absolute -top-25 left-5 z-20 bg-white p-2.5 text-green-900 focus:top-3"
	>Langsung ke isi</a
>
<div class="print-hide on-dark bg-green-900 px-4 py-2 text-center text-[9px] tracking-wide text-green-100 sm:text-[11px]">
	{site.topline}
</div>
<Navbar />
<main id="main" tabindex="-1" class="outline-none">
	{@render children()}
</main>
<Footer />
<WhatsAppFloat packageTitle={data.chatPackage} />
