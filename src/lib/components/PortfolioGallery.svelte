<script lang="ts">
	type Item = { id: number; image: string; alt: string; caption: string | null };

	let { items }: { items: Item[] } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let openId = $state<number | null>(null);
	const index = $derived(items.findIndex((item) => item.id === openId));
	const current = $derived(index >= 0 ? items[index] : null);

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
		const next = items[index + dir];
		if (next) openId = next.id;
	}
</script>

<div class="columns-1 gap-4 sm:columns-2 lg:columns-3">
	{#each items as item (item.id)}
		<figure class="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-line bg-white">
			<button type="button" class="block w-full cursor-pointer" onclick={() => show(item.id)} aria-label="Perbesar foto">
				<img src={item.image} alt={item.alt} loading="lazy" decoding="async" class="w-full" />
			</button>
			{#if item.caption}
				<figcaption class="px-4 py-3 text-xs leading-relaxed">{item.caption}</figcaption>
			{/if}
		</figure>
	{/each}
</div>

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
		<div class="flex items-center justify-end gap-3 border-b border-line px-4 py-3">
			<button type="button" class="cursor-pointer text-xs font-bold" onclick={close}>Tutup</button>
		</div>
		<img src={current.image} alt={current.alt} class="max-h-[70vh] w-full bg-cream object-contain" />
		<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
			{#if current.caption}<p class="text-xs leading-relaxed">{current.caption}</p>{:else}<span></span>{/if}
			<div class="flex gap-2">
				<button type="button" class="cursor-pointer rounded-lg border border-line px-3 py-2 text-xs font-bold disabled:opacity-40" disabled={index <= 0} onclick={() => step(-1)}>Sebelumnya</button>
				<button type="button" class="cursor-pointer rounded-lg border border-line px-3 py-2 text-xs font-bold disabled:opacity-40" disabled={index < 0 || index >= items.length - 1} onclick={() => step(1)}>Berikutnya</button>
			</div>
		</div>
	{/if}
</dialog>
