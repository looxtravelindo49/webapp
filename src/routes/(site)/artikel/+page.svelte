<script lang="ts">
	import ArticleCard from '#lib/components/ArticleCard.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { articlesPage as p } from '#lib/content/popular-articles.js';
	import { collectionNodes, shareImage } from '#lib/seo.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	siteUrl={data.siteUrl}
	path="/artikel"
	title={p.title}
	description={p.description}
	image={shareImage(data.siteUrl)}
	nodes={collectionNodes(data.siteUrl, p.title, p.description)}
/>

<section class="wrap py-11 sm:py-16">
	<div class="mb-8 max-w-xl sm:mb-10">
		<div class="eyebrow">{p.eyebrow}</div>
		<h1 class="my-3 text-[32px] leading-tight font-black tracking-tight sm:text-4xl">{p.heading}</h1>
		<p class="text-xs leading-[1.9] text-muted sm:text-[13px]">{p.intro}</p>
	</div>

	{#if data.articles.length === 0}
		<p class="rounded-xl border border-line bg-cream p-6 text-xs text-muted">{p.empty}</p>
	{:else}
		<div class="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.articles as a (a.id)}
				<ArticleCard article={a} cover />
			{/each}
		</div>
	{/if}
</section>
