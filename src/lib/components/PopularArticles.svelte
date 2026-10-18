<script lang="ts">
	import { popularArticlesSection as s } from '#lib/content/popular-articles.js';
	import type { ArticleSummary } from '#lib/types.js';
	import ArticleCard from './ArticleCard.svelte';

	let { articles }: { articles: ArticleSummary[] } = $props();
</script>

{#if articles.length > 0}
	<section id="artikel-populer" class="wrap py-11 sm:py-16">
		<div class="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-7">
			<div>
				<div class="eyebrow">{s.eyebrow}</div>
				<h2 class="my-2 text-[26px] leading-tight font-black tracking-tight sm:text-[30px]">{s.title}</h2>
				<p class="text-[11px] text-muted sm:text-xs">{s.sub}</p>
			</div>
			<a href="/artikel" class="border-b border-current py-1 text-xs font-bold hover:opacity-80">{s.all} <span aria-hidden="true">↗</span></a>
		</div>

		<div class="grid gap-x-6 sm:grid-cols-3">
			{#each articles as a (a.id)}
				<ArticleCard article={a} cover />
			{/each}
		</div>
	</section>
{/if}
