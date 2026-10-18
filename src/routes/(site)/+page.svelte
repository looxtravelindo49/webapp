<script lang="ts">
	import Destinations from '#lib/components/Destinations.svelte';
	import Hero from '#lib/components/Hero.svelte';
	import Inspiration from '#lib/components/Inspiration.svelte';
	import PackageTabs from '#lib/components/PackageTabs.svelte';
	import TripCalculator from '#lib/components/TripCalculator.svelte';
	import TripToggle from '#lib/components/TripToggle.svelte';
	import Planner from '#lib/components/Planner.svelte';
	import { site } from '#lib/content/site.js';
	import { setTripContext } from '#lib/trip.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// State trip dibuat per render dan dibagi antara tab Paket dan kalkulator.
	const trip = setTripContext();

	const jsonLd = $derived(
		JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: site.name, url: data.siteUrl })
			.replace(/</g, '\\u003c')
			.replace(/>/g, '\\u003e')
			.replace(/&/g, '\\u0026')
	);
</script>

<svelte:head>
	<title>{site.seoTitle}</title>
	<meta name="description" content={site.description} />
	<link rel="canonical" href="{data.siteUrl}/" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={site.seoTitle} />
	<meta property="og:description" content={site.description} />
	<meta property="og:url" content="{data.siteUrl}/" />
	{@html `<script type="application/ld+json">${jsonLd}</script>`}
</svelte:head>

<Hero />
<PackageTabs packages={data.packages} selected={trip.selected}>
	{#snippet action(p)}<TripToggle pkg={p} />{/snippet}
</PackageTabs>
<TripCalculator packages={data.packages} waNumber={data.waNumber} />
<Destinations />
<Planner />
<Inspiration />
