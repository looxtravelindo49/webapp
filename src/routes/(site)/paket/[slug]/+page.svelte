<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import PackageGallery from '#lib/components/PackageGallery.svelte';
	import Seo from '#lib/components/Seo.svelte';
	import { site } from '#lib/content/site.js';
	import { formatRupiah } from '#lib/format.js';
	import { packageMetaDescription, visibleDuration } from '#lib/package-display.js';
	import { packageNodes, shareImage } from '#lib/seo.js';
	import { paragraphs } from '#lib/text.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const p = $derived(data.pkg);
	const gallery = $derived(data.gallery ?? []);
	const lead = $derived(gallery[0]);
	const title = $derived(`${p.title} | ${site.name}`);
	const description = $derived(packageMetaDescription(p.summary, p.body));
	const duration = $derived(visibleDuration(p.duration));
	const share = $derived(shareImage(data.siteUrl, lead?.src ?? p.image));
	const imageAltText = $derived(lead?.alt?.trim() || p.image_alt || p.title);
	const body = $derived(paragraphs(p.body));
</script>

<Seo
	siteUrl={data.siteUrl}
	path="/paket/{p.slug}"
	{title}
	{description}
	image={share}
	imageAlt={share.isDefault ? undefined : imageAltText}
	nodes={packageNodes(data.siteUrl, site, { ...p, image: lead?.src ?? p.image })}
/>

<article class="wrap py-11 sm:py-16">
	<p class="text-xs"><a href="/#katalog" class="font-bold underline">← Katalog paket</a></p>

	<div class="mt-6 grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
		{#if gallery.length > 0}
			<PackageGallery photos={gallery} fallbackAlt={p.image_alt || p.title} />
		{:else}
			<img
				src={p.image}
				alt={p.image_alt || p.title}
				width="960"
				height="720"
				class="aspect-[4/3] w-full rounded-2xl bg-cream object-cover"
			/>
		{/if}
		<div>
			<p class="eyebrow text-signal">Paket aktivitas</p>
			<h1 class="mt-2 text-[30px] leading-tight font-black tracking-tight sm:text-[38px]">{p.title}</h1>
			{#if p.summary}<p class="mt-3 text-sm leading-[1.8] text-muted">{p.summary}</p>{/if}
			<dl class="mt-5 grid gap-3 text-xs sm:grid-cols-2">
				{#if duration}
					<div>
						<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Durasi</dt>
						<dd class="font-bold">{duration}</dd>
					</div>
				{/if}
				<div>
					<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Harga</dt>
					<dd class="font-bold">{p.price_per_person === null ? 'Harga menyusul' : `${formatRupiah(p.price_per_person)} / orang`}</dd>
				</div>
				<div>
					<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Minimal peserta</dt>
					<dd class="font-bold">Min. {p.min_pax.toLocaleString('id-ID')} orang</dd>
				</div>
			</dl>
			<div class="mt-6">
				<Button href="/?paket={p.slug}#konsultasi" variant="primary">Tambah ke Trip</Button>
			</div>
		</div>
	</div>

	{#if body.length > 0}
		<div class="mt-10 max-w-3xl">
			<h2 class="text-lg font-black">Deskripsi</h2>
			{#each body as paragraph, i (i)}
				<p class="mt-3 text-sm leading-[1.9]">{paragraph}</p>
			{/each}
		</div>
	{/if}
</article>
