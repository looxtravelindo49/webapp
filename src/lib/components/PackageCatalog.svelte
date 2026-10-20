<script lang="ts">
	import { CATALOG_PREVIEW, formatPriceTag, PACKAGE_PLACES, packageShortName, visibleDuration } from '#lib/package-display.js';
	import type { Package } from '#lib/types.js';

	let { packages }: { packages: Package[] } = $props();

	let open = $state(false);
	let scroller = $state<HTMLUListElement | null>(null);
	let dot = $state(0);

	const restCount = $derived(Math.max(0, packages.length - CATALOG_PREVIEW));

	function syncDot() {
		const el = scroller;
		if (!el) return;
		const cards = [...el.children] as HTMLElement[];
		const left = el.scrollLeft;
		let best = 0;
		let bestDist = Infinity;
		for (const [i, card] of cards.entries()) {
			const dist = Math.abs(card.offsetLeft - left);
			if (dist < bestDist) {
				best = i;
				bestDist = dist;
			}
		}
		dot = best;
	}

	function showCard(i: number) {
		const el = scroller;
		const card = el?.children[i] as HTMLElement | undefined;
		if (!el || !card) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		el.scrollTo({ left: card.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
	}

	function toggle() {
		open = !open;
		if (open) return;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		document.getElementById('katalog')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
	}
</script>

{#snippet card(p: Package, hiddenOnGrid: boolean)}
	{@const duration = visibleDuration(p.duration)}
	{@const price = formatPriceTag(p.price_per_person)}
	{@const src = p.cover_image || p.image || '/media/forest.svg'}
	{@const alt = (p.cover_image ? p.cover_alt?.trim() : p.image_alt) || p.title}
	<li class="flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-white md:w-auto {hiddenOnGrid ? 'md:hidden' : ''}">
		<img
			src={src}
			alt={alt}
			width="640"
			height="480"
			class="aspect-[4/3] w-full bg-cream object-cover"
		/>
		<div class="flex flex-1 flex-col p-4">
			<h3 class="text-base leading-snug font-black tracking-tight">{p.title}</h3>
			<p class="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
				<svg class="size-3.5 shrink-0 text-signal" viewBox="0 0 16 16" aria-hidden="true">
					<path
						fill="currentColor"
						d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 1.5c-2.7 0-6 1.35-6 3.5V15h12v-2c0-2.15-3.3-3.5-6-3.5Z"
					/>
				</svg>
				by Loox Travel
			</p>
			<ul class="mt-3 flex flex-wrap gap-1.5">
				{#each PACKAGE_PLACES as place (place)}
					<li class="rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-green-900">{place}</li>
				{/each}
			</ul>
			{#if duration || price}
				<p class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
					{#if duration}
						<span class="inline-flex items-center gap-1">
							<svg class="size-3.5 text-signal" viewBox="0 0 16 16" aria-hidden="true">
								<path
									fill="currentColor"
									d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM8 4v4.2l2.6 1.5-.7 1.2L6.7 9V4H8Z"
								/>
							</svg>
							{duration}
						</span>
					{/if}
					{#if price}
						<span class="inline-flex items-center gap-1">
							<svg class="size-3.5 text-signal" viewBox="0 0 16 16" aria-hidden="true">
								<path
									fill="currentColor"
									d="M2.2 3.2h7.2l4.4 4.4-5.2 5.2-4.4-4.4V3.2Zm2.3 2.1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
								/>
							</svg>
							{price}
						</span>
					{/if}
				</p>
			{/if}
			<p class="mt-2 text-[11px] font-semibold text-muted">Min. {p.min_pax.toLocaleString('id-ID')} orang</p>
			<a
				href="/paket/{p.slug}"
				class="mt-4 inline-flex items-center justify-center rounded-lg bg-signal px-4 py-2.5 text-xs font-bold text-white hover:opacity-90"
			>
				Add {packageShortName(p.title)}
			</a>
		</div>
	</li>
{/snippet}

<section id="katalog" class="wrap py-11 sm:py-16" aria-labelledby="katalog-judul">
	<div class="mb-6 sm:mb-7">
		<div class="eyebrow text-signal">Highlight produk</div>
		<h2 id="katalog-judul" class="my-2 text-[26px] leading-tight font-black tracking-tight sm:text-[30px]">Katalog paket</h2>
		<p class="max-w-xl text-[11px] text-muted sm:text-xs">Lihat kegiatan yang bisa kamu masukkan ke trip. Detailnya ada di tiap paket.</p>
	</div>

	{#if packages.length === 0}
		<div class="rounded-[10px] bg-cream p-9 text-center">
			<h3 class="text-lg font-bold">Paket sedang disiapkan</h3>
			<p class="mt-2 text-xs text-muted">Segera hadir. Sementara itu, ceritakan rencanamu lewat tombol konsultasi.</p>
		</div>
	{:else}
		<ul
			id="katalog-daftar"
			bind:this={scroller}
			onscroll={syncDot}
			class="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] motion-reduce:scroll-auto md:grid md:snap-none md:grid-cols-3 md:gap-5 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden"
		>
			{#each packages as p, i (p.slug)}
				{@render card(p, i >= CATALOG_PREVIEW && !open)}
			{/each}
		</ul>
		{#if packages.length > 1}
			<div class="mt-3 flex flex-wrap justify-center gap-1 md:hidden">
				{#each packages as p, i (p.slug)}
					<button
						type="button"
						class="inline-flex size-8 items-center justify-center"
						aria-label="Tampilkan {p.title}"
						aria-current={dot === i ? 'true' : undefined}
						onclick={() => showCard(i)}
					>
						<span class="block size-2 rounded-full {dot === i ? 'bg-signal' : 'bg-line'}"></span>
					</button>
				{/each}
			</div>
		{/if}
		{#if restCount > 0}
			<div class="mt-6 hidden justify-center md:flex">
				<button
					type="button"
					class="inline-flex cursor-pointer items-center justify-center rounded-lg border border-signal bg-white px-5 py-3 text-xs font-bold text-signal hover:bg-cream"
					aria-expanded={open}
					aria-controls="katalog-daftar"
					onclick={toggle}
				>
					{open ? 'Sembunyikan' : 'Lihat semua paket'}
				</button>
			</div>
		{/if}
	{/if}
</section>
