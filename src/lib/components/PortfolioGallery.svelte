<script lang="ts">
	type Item = {
		id: number;
		title: string;
		location: string;
		eventDate: string;
		eventType: string;
		caption: string;
		alt: string;
		image: string | null;
	};

	let { items }: { items: Item[] } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let openId = $state<number | null>(null);
	const photos = $derived(items.filter((item) => item.image));
	const current = $derived(items.find((item) => item.id === openId) ?? null);
	const photoIndex = $derived(photos.findIndex((item) => item.id === openId));

	function show(id: number) {
		openId = id;
	}

	$effect(() => {
		if (openId !== null && dialog && !dialog.open) dialog.showModal();
	});

	function close() {
		dialog?.close();
		openId = null;
	}

	function step(dir: -1 | 1) {
		const next = photos[photoIndex + dir];
		if (next) openId = next.id;
	}
</script>

<ul class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
	{#each items as item (item.id)}
		<li>
			<figure class="overflow-hidden rounded-xl border border-line bg-white">
				{#if item.image}
					<button type="button" class="block w-full cursor-pointer" onclick={() => show(item.id)} aria-label="Perbesar foto {item.title}">
						<img src={item.image} alt={item.alt} width="1600" height="1200" loading="lazy" decoding="async" class="aspect-[4/3] w-full object-cover" />
					</button>
				{:else}
					<div class="flex aspect-[4/3] items-center justify-center bg-cream px-4 text-center text-xs font-bold text-muted">Foto segera</div>
				{/if}
				<figcaption class="p-4">
					<p class="text-[10px] font-bold tracking-[0.14em] uppercase text-muted">{item.eventType}</p>
					<p class="mt-1 text-sm font-black tracking-tight">{item.title}</p>
					<p class="mt-1 text-[11px] text-muted">{item.location} · {item.eventDate}</p>
					<p class="mt-2 text-xs leading-relaxed">{item.caption}</p>
				</figcaption>
			</figure>
		</li>
	{/each}
</ul>

<dialog
	bind:this={dialog}
	class="w-[min(960px,calc(100%-2rem))] rounded-xl border border-line bg-white p-0 text-green-900 backdrop:bg-green-900/70"
	onclose={() => (openId = null)}
	onkeydown={(e) => {
		if (e.key === 'ArrowLeft') step(-1);
		if (e.key === 'ArrowRight') step(1);
	}}
>
	{#if current}
		<div class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
			<p class="text-sm font-black">{current.title}</p>
			<button type="button" class="cursor-pointer text-xs font-bold" onclick={close}>Tutup</button>
		</div>
		{#if current.image}
			<img src={current.image} alt={current.alt} class="max-h-[70vh] w-full bg-cream object-contain" />
		{/if}
		<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			<p class="text-xs leading-relaxed">{current.caption}</p>
			<div class="flex gap-2">
				<button type="button" class="cursor-pointer rounded-lg border border-line px-3 py-2 text-xs font-bold disabled:opacity-40" disabled={photoIndex <= 0} onclick={() => step(-1)}>Sebelumnya</button>
				<button type="button" class="cursor-pointer rounded-lg border border-line px-3 py-2 text-xs font-bold disabled:opacity-40" disabled={photoIndex < 0 || photoIndex >= photos.length - 1} onclick={() => step(1)}>Berikutnya</button>
			</div>
		</div>
	{/if}
</dialog>
