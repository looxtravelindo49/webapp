<script lang="ts">
	import { catalogAlt, catalogImage, catalogLocation, catalogMatches, catalogPrice, catalogProfile, CATALOG_FILTERS, unitPriceNote, type CatalogFilterId } from '#lib/catalog.js';
	import { kegiatanHash, openKegiatan } from '#lib/kegiatan.js';
	import type { Package } from '#lib/types.js';

	function openDetail(event: MouseEvent, slug: string) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		openKegiatan(slug);
	}

	let { packages }: { packages: Package[] } = $props();

	let filter = $state<CatalogFilterId>('all');

	const notes = $derived(packages.map(unitPriceNote).filter((note): note is string => !!note));
</script>

<section id="katalog" class="bg-cream" aria-labelledby="katalog-judul">
	<div class="mx-auto w-full max-w-[1280px] px-3.5 py-8 sm:px-8 sm:py-14">
		<p class="text-[13px] font-bold tracking-[0.18em] text-green-800">HANDPICKED EXPERIENCES</p>
		<div class="mt-2 mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
			<div>
				<h2 id="katalog-judul" class="text-2xl leading-tight font-black tracking-tight sm:text-4xl">Aktivitas Pilihan di Lembang</h2>
				<p class="mt-2.5 max-w-xl text-sm leading-normal text-muted sm:text-base">Pilih kegiatan untuk trip tim kamu. Detail dan estimasi ada di tiap paket.</p>
			</div>
			{#if packages.length > 0}
				<button type="button" class="text-sm font-bold text-green-800 underline" onclick={() => (filter = 'all')}>
					Reset filter <span aria-hidden="true">↺</span>
				</button>
			{/if}
		</div>

		{#if packages.length === 0}
			<div class="rounded-[10px] bg-white p-9 text-center">
				<h3 class="text-lg font-bold">Paket sedang disiapkan</h3>
				<p class="mt-2 text-xs text-muted">Segera hadir. Sementara itu, ceritakan rencanamu lewat tombol konsultasi.</p>
			</div>
		{:else}
			<div class="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter paket">
				{#each CATALOG_FILTERS as chip (chip.id)}
					<button
						type="button"
						class="cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-semibold {filter === chip.id
							? 'border-green-900 bg-green-900 text-white'
							: 'border-line bg-white text-green-900'}"
						aria-pressed={filter === chip.id}
						onclick={() => (filter = chip.id)}
					>
						{chip.label}
					</button>
				{/each}
			</div>

			<ul id="katalog-daftar" class="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
				{#each packages as p (p.slug)}
					{@const profile = catalogProfile(p.slug)}
					{@const price = catalogPrice(p)}
					{@const show = catalogMatches(p.slug, filter)}
					<li class="min-w-0 {show ? '' : 'hidden'}">
						<article class="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white">
							<div class="relative aspect-[4/3] bg-green-100">
								<img
									src={catalogImage(p)}
									alt={catalogAlt(p)}
									width="800"
									height="600"
									loading="lazy"
									decoding="async"
									class="h-full w-full object-cover"
								/>
								{#if profile}
									<span
										class="absolute top-2 left-2 rounded-lg px-1.5 py-1 text-[10.5px] font-bold shadow-sm sm:top-3 sm:left-3 sm:px-2.5 sm:py-1.5 sm:text-xs {profile.hot
											? 'bg-accent text-green-900'
											: 'bg-white text-green-900'}"
									>
										{profile.badge}
									</span>
								{/if}
							</div>
							<div class="flex flex-1 flex-col p-2.5 sm:p-4">
								<p class="mb-2 text-[11px] text-muted sm:text-xs">
									<svg class="mr-1 inline-block size-2.5 align-[-1px] text-green-800" viewBox="0 0 24 24" aria-hidden="true">
										<path
											fill="currentColor"
											d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
										/>
									</svg>
									{catalogLocation(p)}
								</p>
								<h3 class="text-sm leading-snug font-bold sm:text-[17px]">{p.title}</h3>
								{#if p.summary.trim()}
									<p class="mt-2 line-clamp-2 text-xs leading-normal text-muted sm:text-[13.5px]">{p.summary}</p>
								{/if}
								<div class="mt-auto border-t border-line pt-3">
									<p class="text-[11px] text-muted sm:text-[12.5px]">Min. {p.min_pax.toLocaleString('id-ID')} peserta</p>
									<p class="mt-1 mb-3 text-[15px] font-extrabold sm:text-lg">
										{price.amount}{#if price.unit}<small class="text-xs font-semibold text-muted">{price.unit}</small>{/if}
									</p>
									<a
										href={kegiatanHash(p.slug)}
										class="block rounded-[10px] bg-green-100 px-2 py-2.5 text-center text-[12.5px] font-bold text-green-800 hover:bg-[#d6e5df] sm:py-[11px] sm:text-sm"
										onclick={(event) => openDetail(event, p.slug)}
									>
										Lihat Detail <span aria-hidden="true">↗</span>
									</a>
								</div>
							</div>
						</article>
					</li>
				{/each}
			</ul>
			{#if notes.length > 0}
				{#each notes as note (note)}
					<p class="mt-4 text-xs text-muted">{note}</p>
				{/each}
			{/if}
		{/if}
	</div>
</section>
