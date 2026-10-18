<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { site } from '#lib/content/site.js';
	import { formatDate } from '#lib/format.js';
	import { coverImage, creditLinks, isUnsplashImage, useFallbackImage } from '#lib/images.js';
	import { articleNodes, shareImage } from '#lib/seo.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const a = $derived(data.article);
	const title = $derived(`${a.title} | ${site.name}`);
	const share = $derived(shareImage(data.siteUrl, a.cover_image));
	// Kredit hanya untuk sampul yang benar-benar foto Unsplash.
	const credit = $derived(
		a.cover_unsplash_id && a.cover_credit_name && isUnsplashImage(a.cover_image)
			? creditLinks({ name: a.cover_credit_name, url: a.cover_credit_url }, data.utmSource)
			: null
	);
</script>

<Seo
	siteUrl={data.siteUrl}
	path="/artikel/{a.slug}"
	{title}
	description={a.excerpt}
	type="article"
	image={share}
	imageAlt={share.isDefault ? undefined : a.cover_alt || a.title}
	publishedTime={a.published_at}
	modifiedTime={a.updated_at}
	nodes={articleNodes(data.siteUrl, site, a)}
/>

<article class="wrap py-11 sm:py-16">
	<div class="mx-auto max-w-180">
		<p class="text-xs"><a href="/artikel" class="font-bold underline">← Semua artikel</a></p>

		<header class="mt-6 mb-7 sm:mb-9">
			<div class="eyebrow text-muted">{a.category}</div>
			<h1 class="my-3 text-[30px] leading-tight font-black tracking-tight sm:text-[38px]">{a.title}</h1>
			{#if a.published_at}
				<time datetime={a.published_at} class="text-[11px] font-semibold text-muted">{formatDate(a.published_at)}</time>
			{/if}
		</header>

		<figure class="mb-8 sm:mb-10">
			<img
				src={coverImage(a.cover_image, { w: 1200, h: 675 })}
				alt={a.cover_alt || a.title}
				width="1200"
				height="675"
				onerror={useFallbackImage}
				class="aspect-video w-full rounded-xl bg-cream object-cover"
			/>
			{#if credit}
				<figcaption class="mt-2 text-[11px] text-muted">
					Foto oleh
					{#if credit.profile}<a href={credit.profile} target="_blank" rel="noopener noreferrer" class="font-bold underline">{credit.name}</a>{:else}{credit.name}{/if}
					di <a href={credit.unsplash} target="_blank" rel="noopener noreferrer" class="font-bold underline">Unsplash</a>
				</figcaption>
			{/if}
		</figure>

		<!-- HTML ini hanya berasal dari renderMarkdown (daftar putih), bukan masukan mentah. -->
		<div class="article-body">{@html data.html}</div>

		<aside class="mt-12 rounded-xl bg-cream p-6 sm:p-7">
			<strong class="block text-sm">Punya rencana trip untuk timmu?</strong>
			<p class="mt-1.5 mb-4 text-xs text-muted">Ceritakan kebutuhanmu dan lihat estimasi biayanya.</p>
			<Button href="/#konsultasi">Konsultasi Trip <span aria-hidden="true">↗</span></Button>
		</aside>
	</div>
</article>
