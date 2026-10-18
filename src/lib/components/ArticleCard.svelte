<script lang="ts">
	import { formatDate } from '#lib/format.js';
	import { coverImage, useFallbackImage } from '#lib/images.js';
	import type { ArticleSummary } from '#lib/types.js';

	let {
		article,
		cover = false
	}: {
		article: Pick<ArticleSummary, 'slug' | 'title' | 'category' | 'excerpt' | 'cover_image' | 'cover_alt' | 'published_at'>;
		/** Tampilkan sampul 16:9 di atas kartu (beranda dan halaman daftar); tanpa sampul tersimpan dipakai gambar bawaan. */
		cover?: boolean;
	} = $props();

	const date = $derived(formatDate(article.published_at));
</script>

<a
	href="/artikel/{article.slug}"
	class="group flex h-full flex-col items-start justify-start border-t border-line bg-white py-4 text-left text-green-900 no-underline sm:py-5"
>
	{#if cover}
		<img
			src={coverImage(article.cover_image, { w: 600, h: 338 })}
			alt={article.cover_alt ?? ''}
			onerror={useFallbackImage}
			loading="lazy"
			width="600"
			height="338"
			class="mb-4 aspect-video w-full rounded-[10px] bg-cream object-cover"
		/>
	{/if}
	<small class="text-[9px] tracking-[0.15em] text-muted uppercase">{article.category}</small>
	<h3 class="mt-2.5 mb-2.5 text-[19px] leading-[1.55] font-bold tracking-tight group-hover:text-green-800 sm:text-[17px]">
		{article.title}
	</h3>
	<p class="mb-4 text-xs leading-[1.8] text-muted">{article.excerpt}</p>
	<span class="mt-auto flex w-full items-center justify-between gap-3 text-[11px] font-bold">
		<span>Baca selengkapnya ↗</span>
		{#if cover && date}<time datetime={article.published_at ?? undefined} class="font-semibold text-muted">{date}</time>{/if}
	</span>
</a>
