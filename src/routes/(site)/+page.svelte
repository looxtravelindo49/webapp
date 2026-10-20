<script lang="ts">
	import Destinations from '#lib/components/Destinations.svelte';
	import Hero from '#lib/components/Hero.svelte';
	import PackageCatalog from '#lib/components/PackageCatalog.svelte';
	import PackageTabs from '#lib/components/PackageTabs.svelte';
	import PopularArticles from '#lib/components/PopularArticles.svelte';
	import TripCalculator from '#lib/components/TripCalculator.svelte';
	import TripToggle from '#lib/components/TripToggle.svelte';
	import Planner from '#lib/components/Planner.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { site } from '#lib/content/site.js';
	import { organizationNode, shareImage, websiteNode } from '#lib/seo.js';
	import { untrack } from 'svelte';
	import { setTripContext } from '#lib/trip.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// State trip dibuat per render dan dibagi antara tab Paket dan kalkulator.
	const trip = setTripContext();
	// `?paket=` dari halaman detail menandai paket di kalkulator. Pengunjung tetap bisa menghapusnya.
	$effect(() => {
		const slug = data.preselect;
		if (!slug) return;
		untrack(() => {
			if (!trip.has(slug)) trip.selected = [...trip.selected, slug];
		});
	});

	const nodes = $derived([organizationNode(data.siteUrl, site, data.waNumber), websiteNode(data.siteUrl, site)]);
</script>

<Seo
	siteUrl={data.siteUrl}
	path="/"
	title={site.seoTitle}
	description={site.description}
	image={shareImage(data.siteUrl)}
	{nodes}
/>

<Hero />
<PackageCatalog packages={data.packages} />
<PackageTabs packages={data.packages} selected={trip.selected}>
	{#snippet action(p)}<TripToggle pkg={p} />{/snippet}
</PackageTabs>
<TripCalculator packages={data.packages} waNumber={data.waNumber} />
<PopularArticles articles={data.popularArticles} />
<Destinations />
<Planner />
