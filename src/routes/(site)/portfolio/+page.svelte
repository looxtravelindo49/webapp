<script lang="ts">
	import PortfolioGallery from '#lib/components/PortfolioGallery.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import Testimonials from '#lib/components/Testimonials.svelte';
	import { site } from '#lib/content/site.js';
	import { absoluteUrl, breadcrumbNode, shareImage } from '#lib/seo.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const title = `Portfolio | ${site.name}`;
	const description = 'Dokumentasi kegiatan Lembang Adventure by Loox Travel: gathering, outing, dan aktivitas tim.';
</script>

<Seo
	siteUrl={data.siteUrl}
	path="/portfolio"
	{title}
	{description}
	image={shareImage(data.siteUrl)}
	nodes={[
		{ '@type': 'CollectionPage', name: 'Portfolio', description, url: absoluteUrl(data.siteUrl, '/portfolio'), inLanguage: 'id' },
		breadcrumbNode(data.siteUrl, [
			{ name: 'Beranda', path: '/' },
			{ name: 'Portfolio', path: '/portfolio' }
		])
	]}
/>

<section class="wrap py-11 sm:py-16">
	<div class="mb-8 max-w-xl sm:mb-10">
		<div class="eyebrow">Dokumentasi</div>
		<h1 class="my-3 text-[32px] leading-tight font-black tracking-tight sm:text-4xl">Portfolio</h1>
		<p class="text-xs leading-[1.9] text-muted sm:text-[13px]">Kegiatan yang sudah berjalan bersama tim dan perusahaan.</p>
	</div>
	{#if data.items.length === 0}
		<p class="rounded-xl border border-line bg-cream p-6 text-xs text-muted">Dokumentasi kegiatan akan ditampilkan di sini.</p>
	{:else}
		<PortfolioGallery items={data.items} />
	{/if}
</section>

<Testimonials reviews={data.reviews} />
