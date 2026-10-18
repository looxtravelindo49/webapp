<script lang="ts">
	import { destinations, destinationsSection as s, type Destination } from '#lib/content/destinations.js';
	import { paragraphs } from '#lib/text.js';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	let open = $state(false);
	let restoreFocus = $state(true);
	let current = $state<Destination>(destinations[0]);

	function show(d: Destination) {
		current = d;
		open = true;
	}
</script>

<section id="destinasi" class="border-y border-line bg-cream py-11 sm:py-16">
	<div class="wrap">
		<div class="mb-6 sm:mb-7">
			<div class="eyebrow">{s.eyebrow}</div>
			<h2 class="my-2 text-[26px] leading-tight font-black tracking-tight sm:text-[30px]">{s.title}</h2>
			<p class="text-[11px] text-muted sm:text-xs">{s.sub}</p>
		</div>

		<div class="grid gap-3.5 sm:grid-cols-3 sm:gap-4.5">
			{#each destinations as d (d.place)}
				<button
					type="button"
					onclick={() => show(d)}
					aria-haspopup="dialog"
					class="group relative h-43.75 overflow-hidden rounded-[10px] border-0 bg-green-800 p-0 text-left sm:h-48.75 md:h-55"
				>
					<img
						src={d.image}
						alt=""
						loading="lazy"
						width="600"
						height="440"
						class="size-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
					<span class="absolute inset-0 bg-linear-to-b from-transparent from-20% to-green-900/70"></span>
					<span class="absolute inset-x-5.5 bottom-5 flex items-end justify-between text-white">
						<span>
							<small class="text-[10px] tracking-wider">{d.tagline}</small>
							<b class="block text-2xl tracking-tight">{d.place}</b>
						</span>
						<span aria-hidden="true">↗</span>
					</span>
				</button>
			{/each}
		</div>
	</div>
</section>

<Dialog bind:open bind:restoreFocus title={current.name} label={current.place.toUpperCase()}>
	<p class="mb-1.5 text-xs text-muted">{current.desc}</p>
	<p class="mb-4 text-xs font-bold">{current.meta}</p>
	{#each paragraphs(current.detail) as p (p)}
		<p class="mb-4 text-[13px] leading-[1.9]">{p}</p>
	{/each}
	<Button
		href="#konsultasi"
		class="mt-2 w-full"
		onclick={() => {
			// Tutup dialog tanpa mengembalikan fokus ke kartu, lalu pindahkan fokus ke tujuan.
			// dialog.close() bawaan peramban mengembalikan fokus secara sinkron, jadi pemindahan
			// dilakukan sesudahnya.
			restoreFocus = false;
			open = false;
			setTimeout(() => document.getElementById('konsultasi')?.focus({ preventScroll: true }), 0);
		}}>Konsultasi ide ini <span aria-hidden="true">↗</span></Button
	>
</Dialog>
