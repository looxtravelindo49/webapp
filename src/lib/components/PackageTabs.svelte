<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import PackageGallery from '#lib/components/PackageGallery.svelte';
	import { formatRupiah } from '#lib/format.js';
	import { lines, paragraphs } from '#lib/text.js';
	import type { Package } from '#lib/types.js';

	let {
		packages,
		selected = [],
		action
	}: {
		packages: Package[];
		/** Slug paket yang sudah dipilih untuk trip (diberi penanda di tab). */
		selected?: readonly string[];
		/** Slot aksi per panel (mis. tombol "Tambah ke trip" di change trip-calculator). */
		action?: Snippet<[Package]>;
	} = $props();

	const uid = $props.id();
	let chosen = $state<string | null>(null);
	// Jika paket terpilih tak lagi ada (mis. di-draft), kembali ke tab pertama.
	const active = $derived(packages.some((p) => p.slug === chosen) ? chosen : (packages[0]?.slug ?? ''));

	const tabId = (slug: string) => `${uid}-tab-${slug}`;
	const panelId = (slug: string) => `${uid}-panel-${slug}`;

	function select(slug: string, { focus = false, updateHash = true } = {}) {
		chosen = slug;
		if (updateHash) void goto(`#paket-${slug}`, { shallow: true, replace: true });
		if (focus) document.getElementById(tabId(slug))?.focus();
	}

	function onkeydown(e: KeyboardEvent) {
		const i = packages.findIndex((p) => p.slug === active);
		const last = packages.length - 1;
		const next =
			e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
			: e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
			: e.key === 'Home' ? 0
			: e.key === 'End' ? last
			: -1;
		if (next < 0) return;
		e.preventDefault();
		select(packages[next].slug, { focus: true });
	}

	// Hash yang tidak dikenal diabaikan (tab pertama tetap terpilih).
	function fromHash(scroll: boolean) {
		const m = location.hash.match(/^#paket-(.+)$/);
		const slug = m && packages.find((p) => p.slug === decodeURIComponent(m[1]))?.slug;
		if (!slug) return;
		select(slug, { updateHash: false });
		if (scroll) document.getElementById('paket')?.scrollIntoView();
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
		<div
			role="tablist"
			aria-label="Pilihan paket kegiatan"
			tabindex="-1"
			{onkeydown}
			class="relative -mx-1 mb-6 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{#each packages as p (p.slug)}
				{@const current = p.slug === active}
				{@const picked = selected.includes(p.slug)}
				<button
					type="button"
					role="tab"
					id={tabId(p.slug)}
					aria-selected={current}
					aria-controls={panelId(p.slug)}
					tabindex={current ? 0 : -1}
					onclick={() => select(p.slug)}
					class="shrink-0 snap-start cursor-pointer rounded-full border px-5 py-2 text-xs font-bold whitespace-nowrap transition-colors {current
						? 'border-green-900 bg-accent text-green-900'
						: 'border-line bg-white text-muted hover:bg-cream hover:text-green-900'}"
					>{p.title}{#if picked}<span aria-hidden="true" class="ml-1.5">✓</span><span class="sr-only"> (dipilih)</span>{/if}</button
				>
			{/each}
		</div>

		{#each packages as p (p.slug)}
			{@const included = lines(p.includes)}
			<div
				role="tabpanel"
				id={panelId(p.slug)}
				aria-labelledby={tabId(p.slug)}
				hidden={p.slug !== active}
				tabindex="-1"
				class="grid gap-6 outline-none md:grid-cols-[1fr_1.1fr] md:gap-12"
			>
				{#if (p.gallery?.length ?? 0) > 0}
					<div class="md:self-start">
						<PackageGallery photos={p.gallery ?? []} fallbackAlt={p.image_alt || p.title} running={p.slug === active} />
					</div>
				{:else}
					<img
						src={p.image}
						alt={p.image_alt ?? p.title}
						width="600"
						height="440"
						loading="lazy"
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
			</div>
		{/each}

		<p class="mt-6 text-[10px] text-muted">
			Harga dan fasilitas mengikuti tanggal, jumlah peserta, ketersediaan, dan penawaran yang disepakati.
		</p>
	{/if}
</section>
