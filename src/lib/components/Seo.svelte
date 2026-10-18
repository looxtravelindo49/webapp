<script lang="ts">
	import { site } from '#lib/content/site.js';
	import { absoluteUrl, jsonLdGraph, OG_DEFAULT_SIZE, serializeJsonLd, type ShareImage } from '#lib/seo.js';

	let {
		siteUrl,
		path,
		title,
		description,
		type = 'website',
		image,
		imageAlt,
		publishedTime,
		modifiedTime,
		nodes = []
	}: {
		/** Origin situs (`PUBLIC_SITE_URL`), dari data layout. */
		siteUrl: string;
		/** Path halaman (`/`, `/artikel`, `/artikel/x`); dipakai untuk canonical dan `og:url`. */
		path: string;
		title: string;
		description: string;
		type?: 'website' | 'article';
		image: ShareImage;
		/** Teks alternatif gambar bagikan; bila kosong dipakai deskripsi merek. */
		imageAlt?: string;
		publishedTime?: string | null;
		modifiedTime?: string | null;
		/** Node JSON-LD yang dibungkus menjadi satu `@graph`. */
		nodes?: Record<string, unknown>[];
	} = $props();

	const url = $derived(absoluteUrl(siteUrl, path));
	const alt = $derived(imageAlt || `${site.name}. ${site.footerNote}`);
	const ld = $derived(nodes.length ? serializeJsonLd(jsonLdGraph(nodes)) : '');
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={url} />
	<meta property="og:site_name" content={site.name} />
	<meta property="og:locale" content="id_ID" />
	<meta property="og:type" content={type} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={image.url} />
	<meta property="og:image:alt" content={alt} />
	{#if image.isDefault}
		<meta property="og:image:width" content={String(OG_DEFAULT_SIZE.width)} />
		<meta property="og:image:height" content={String(OG_DEFAULT_SIZE.height)} />
	{/if}
	{#if type === 'article'}
		{#if publishedTime}<meta property="article:published_time" content={publishedTime} />{/if}
		{#if modifiedTime}<meta property="article:modified_time" content={modifiedTime} />{/if}
	{/if}
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image.url} />
	<meta name="twitter:image:alt" content={alt} />
	{#if ld}{@html `<script type="application/ld+json">${ld}</script>`}{/if}
</svelte:head>
