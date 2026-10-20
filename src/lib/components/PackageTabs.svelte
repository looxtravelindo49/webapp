<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import PackageGallery from '#lib/components/PackageGallery.svelte';
	import { formatRupiah } from '#lib/format.js';
	import { lines, paragraphs } from '#lib/text.js';
	import type { Package } from '#lib/types.js';

	let {
		packages,
		action
	}: {
		packages: Package[];
		/** Slot aksi per slide (mis. tombol "Tambah ke trip"). */
		action?: Snippet<[Package]>;
	} = $props();

	const uid = $props.id();
	let scroller = $state<HTMLUListElement | null>(null);
	let tabRow = $state<HTMLDivElement | null>(null);
	let index = $state(0);
	let tabFade = $state(false);
	// Selama gulir terprogram, event scroll tidak boleh menimpa indeks tujuan.
	let lock = 0;

	const safe = $derived(packages.length === 0 ? 0 : Math.min(index, packages.length - 1));
	const tabId = (slug: string) => `${uid}-tab-${slug}`;
	const slideId = (slug: string) => `${uid}-slide-${slug}`;

	function reduced() {
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	}

	function scrollToSlide(i: number) {
		const el = scroller;
		const card = el?.children[i] as HTMLElement | undefined;
		if (!el || !card) return;
		const left = card.offsetLeft;
		if (Math.abs(el.scrollLeft - left) < 2) return;
		const token = ++lock;
		const release = () => {
			if (lock !== token) return;
			lock = 0;
		};
		el.addEventListener('scrollend', release, { once: true });
		window.setTimeout(release, reduced() ? 50 : 700);
		el.scrollTo({ left, behavior: reduced() ? 'auto' : 'smooth' });
	}

	function setHash(slug: string) {
		const next = `#paket-${slug}`;
		if (location.hash === next) return;
		void goto(next, { shallow: true, replace: true });
	}

	function syncTabFade() {
		const row = tabRow;
		if (!row) return;
		tabFade = row.scrollWidth - row.clientWidth - row.scrollLeft > 2;
	}

	/** Geser pil aktif ke dalam baris, dan sisakan pil berikutnya mengintip bila masih ada. */
	function scrollTabIntoView(i: number) {
		const row = tabRow;
		const tab = row?.children[i] as HTMLElement | undefined;
		if (!row || !tab) return;
		const peek = 36;
		const tabLeft = tab.offsetLeft;
		const tabRight = tabLeft + tab.offsetWidth;
		const viewLeft = row.scrollLeft;
		const viewRight = viewLeft + row.clientWidth;
		let left = viewLeft;
		if (tabLeft < viewLeft + 4) left = Math.max(0, tabLeft - 4);
		else if (tabRight > viewRight - peek) left = Math.max(0, tabRight - row.clientWidth + peek);
		const max = Math.max(0, row.scrollWidth - row.clientWidth);
		left = Math.min(left, max);
		if (Math.abs(left - viewLeft) < 2) return;
		row.scrollTo({ left, behavior: reduced() ? 'auto' : 'smooth' });
	}

	$effect(() => {
		const row = tabRow;
		const i = safe;
		if (!row || packages.length === 0) return;
		scrollTabIntoView(i);
		syncTabFade();
		const ro = new ResizeObserver(() => syncTabFade());
		ro.observe(row);
		return () => ro.disconnect();
	});

	function go(i: number) {
		const n = packages.length;
		if (n === 0) return;
		const next = ((i % n) + n) % n;
		index = next;
		scrollToSlide(next);
		setHash(packages[next].slug);
	}

	function sync() {
		const el = scroller;
		if (!el || lock || packages.length === 0) return;
		const left = el.scrollLeft;
		let best = 0;
		let bestDist = Infinity;
		for (let i = 0; i < el.children.length; i++) {
			const card = el.children[i] as HTMLElement;
			const dist = Math.abs(card.offsetLeft - left);
			if (dist < bestDist) {
				best = i;
				bestDist = dist;
			}
		}
		if (best === index) return;
		index = best;
		const slug = packages[best]?.slug;
		if (slug) setHash(slug);
	}

	function move(key: string) {
		if (packages.length < 2) return null;
		if (key === 'ArrowRight') return safe + 1;
		if (key === 'ArrowLeft') return safe - 1;
		if (key === 'Home') return 0;
		if (key === 'End') return packages.length - 1;
		return null;
	}

	function onTabKey(e: KeyboardEvent) {
		const next = move(e.key);
		if (next === null) return;
		e.preventDefault();
		const n = packages.length;
		const i = ((next % n) + n) % n;
		go(i);
		document.getElementById(tabId(packages[i].slug))?.focus();
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t?.closest('a, button, input, textarea, select')) return;
		const next = move(e.key);
		if (next === null) return;
		e.preventDefault();
		go(next);
	}

	// Hash yang tidak dikenal diabaikan (slide pertama tetap tampil).
	// Hash yang sama dengan slide aktif tidak menggulir halaman (geser sendiri memakai replace).
	function fromHash(scrollPage: boolean) {
		const m = location.hash.match(/^#paket-(.+)$/);
		const found = m ? packages.findIndex((p) => p.slug === decodeURIComponent(m[1])) : -1;
		if (found < 0) return;
		const same = found === index;
		index = found;
		scrollToSlide(found);
		if (scrollPage && !same) document.getElementById('paket')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
	}

	onMount(() => fromHash(true));
</script>

<svelte:window onhashchange={() => fromHash(true)} />

<section id="paket" class="wrap py-11 sm:py-16">
	<div class="mb-6 sm:mb-7">
		<div class="eyebrow">PILIH KEGIATAN</div>
		<h2 class="my-2 text-[26px] leading-tight font-black tracking-tight sm:text-[30px]">Satu tim, banyak cerita.</h2>
		<p class="text-[11px] text-muted sm:text-xs">Mulai dari kegiatan yang paling cocok untuk timmu.</p>
	</div>

	{#if packages.length === 0}
		<div class="rounded-[10px] bg-cream p-9 text-center">
			<h3 class="text-lg font-bold">Paket sedang disiapkan</h3>
			<p class="mt-2 text-xs text-muted">Segera hadir. Sementara itu, ceritakan rencanamu lewat tombol konsultasi.</p>
		</div>
	{:else}
		<div class="relative mb-6">
			<div
				bind:this={tabRow}
				role="tablist"
				aria-label="Pilihan paket kegiatan"
				tabindex="-1"
				onscroll={syncTabFade}
				onkeydown={onTabKey}
				class="relative flex flex-nowrap gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{#each packages as p, i (p.slug)}
					<button
						type="button"
						role="tab"
						id={tabId(p.slug)}
						aria-selected={i === safe}
						aria-controls={slideId(p.slug)}
						tabindex={i === safe ? 0 : -1}
						onclick={() => go(i)}
						class="shrink-0 cursor-pointer rounded-full border px-5 py-2 text-xs font-bold whitespace-nowrap transition-colors {i === safe
							? 'border-green-900 bg-accent text-green-900'
							: 'border-line bg-white text-muted hover:bg-cream hover:text-green-900'}"
						>{p.title}</button
					>
				{/each}
			</div>
			{#if tabFade}
				<div
					aria-hidden="true"
					data-tab-fade
					class="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent"
				></div>
			{/if}
		</div>

		<div class="relative">
			{#if packages.length > 1}
				<button
					type="button"
					class="absolute top-1/2 left-1 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-xl leading-none font-bold text-green-900 shadow-sm md:inline-flex"
					aria-label="Paket sebelumnya"
					onclick={() => go(safe - 1)}
				>
					<span aria-hidden="true">‹</span>
				</button>
				<button
					type="button"
					class="absolute top-1/2 right-1 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-xl leading-none font-bold text-green-900 shadow-sm md:inline-flex"
					aria-label="Paket berikutnya"
					onclick={() => go(safe + 1)}
				>
					<span aria-hidden="true">›</span>
				</button>
			{/if}

			<!-- Pola carousel: region ini menerima panah keyboard, jadi tabindex dan onkeydown disengaja. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				role="region"
				aria-roledescription="carousel"
				aria-label="Paket kegiatan"
				tabindex="0"
				onkeydown={onKey}
				class="rounded-xl outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
			>
				<ul
					bind:this={scroller}
					onscroll={sync}
					class="relative flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{#each packages as p, i (p.slug)}
						{@const included = lines(p.includes)}
						<li
							id={slideId(p.slug)}
							class="grid w-full min-w-full shrink-0 snap-start grid-cols-1 gap-6 md:grid-cols-[1fr_1.1fr] md:gap-12"
							role="group"
							aria-roledescription="slide"
							aria-label="{i + 1} dari {packages.length}: {p.title}"
							aria-hidden={i !== safe ? 'true' : undefined}
							inert={i !== safe}
						>
							{#if (p.gallery?.length ?? 0) > 0}
								<div class="md:self-start">
									<PackageGallery
										photos={p.gallery ?? []}
										fallbackAlt={p.image_alt || p.title}
										running={i === safe}
										swipe={false}
									/>
								</div>
							{:else}
								<img
									src={p.image}
									alt={p.image_alt ?? p.title}
									width="600"
									height="440"
									loading="lazy"
									draggable="false"
									class="aspect-[1.27] w-full rounded-xl bg-cream object-cover md:self-start"
								/>
							{/if}
							<div>
								{#if p.duration}<div class="eyebrow text-muted">{p.duration}</div>{/if}
								<h3 class="my-2 text-[26px] leading-tight font-black tracking-tight">{p.title}</h3>
								<p class="text-[13px] leading-[1.9] text-muted">{p.summary}</p>

								<div class="my-5 border-y border-line py-4">
									{#if p.price_per_person === null}
										<strong class="text-lg">Harga menyusul</strong>
									{:else}
										<strong class="text-lg">{formatRupiah(p.price_per_person)}</strong>
										<span class="text-xs text-muted"> / orang</span>
									{/if}
									{#if p.min_pax > 1}
										<small class="mt-0.5 block text-[11px] text-muted">Minimal {p.min_pax} peserta</small>
									{/if}
								</div>

								{#if action}
									<div class="mb-5">{@render action(p)}</div>
								{/if}

								{#each paragraphs(p.body) as para (para)}
									<p class="mb-4 text-[13px] leading-[1.9]">{para}</p>
								{/each}

								{#if included.length}
									<h4 class="mt-5 mb-2 text-xs font-extrabold tracking-wider uppercase">Pilihan yang dapat dibahas</h4>
									<ul class="space-y-1.5 text-[13px]">
										{#each included as item (item)}
											<li class="flex gap-2.5">
												<span aria-hidden="true" class="mt-0.5 text-green-800">✓</span><span>{item}</span>
											</li>
										{/each}
									</ul>
								{/if}

								{#if p.notes.trim()}
									<h4 class="mt-5 mb-2 text-xs font-extrabold tracking-wider uppercase">Catatan program</h4>
									<p class="text-xs leading-[1.8] text-muted">{p.notes}</p>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<p class="mt-6 text-[10px] text-muted">
			Harga dan fasilitas mengikuti tanggal, jumlah peserta, ketersediaan, dan penawaran yang disepakati.
		</p>
	{/if}
</section>
