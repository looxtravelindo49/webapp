<script lang="ts">
	import type { ClientLogo } from '#lib/clients.js';

	let { clients }: { clients: readonly ClientLogo[] } = $props();

	// Dua salinan untuk 11 klien (geser 50%). Daftar pendek diulang sampai pita tetap penuh.
	const copies = $derived(clients.length === 0 ? 1 : Math.max(2, Math.ceil(12 / clients.length)));
	const shift = $derived(`${Number((100 / copies).toFixed(4))}%`);
	const loop = $derived(Array.from({ length: copies }, () => clients).flat());
</script>

{#if clients.length > 0}
	<section id="klien" class="border-y border-line bg-cream py-10 sm:py-14" aria-labelledby="klien-judul">
		<div class="wrap mb-6 text-center">
			<h2 id="klien-judul" class="text-xl font-black tracking-tight sm:text-2xl">Our Clients</h2>
		</div>
		<ul class="sr-only">
			{#each clients as client (client.id)}
				<li>{client.name}</li>
			{/each}
		</ul>
		<div class="clients-marquee" aria-hidden="true">
			<ul class="clients-track" style="--clients-shift: {shift}">
				{#each loop as client, i (`${client.id}-${i}`)}
					<li class="clients-item" class:clients-copy={i >= clients.length}>
						{#if client.src}
							<img src={client.src} alt="" />
						{:else}
							<span class="clients-word">{client.name}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	</section>
{/if}

<style>
	.clients-marquee {
		overflow: hidden;
		container-type: inline-size;
	}
	.clients-track {
		display: flex;
		width: max-content;
		align-items: center;
		margin: 0;
		padding: 0;
		list-style: none;
		animation: clients-scroll 36s linear infinite;
	}
	.clients-item {
		display: flex;
		flex: 0 0 calc(100cqw / 2.4);
		align-items: center;
		justify-content: center;
		height: 4.5rem;
		padding: 0 0.75rem;
	}
	.clients-item img {
		width: auto;
		max-width: 78%;
		height: auto;
		max-height: 2.6rem;
		object-fit: contain;
		filter: grayscale(1);
		opacity: 0.82;
	}
	.clients-word {
		color: var(--color-muted);
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		line-height: 1.2;
		text-align: center;
	}
	@keyframes clients-scroll {
		from {
			transform: translateX(0);
		}
		to {
			transform: translateX(calc(var(--clients-shift, 50%) * -1));
		}
	}
	@media (min-width: 768px) {
		.clients-item {
			flex-basis: calc(100cqw / 4);
		}
	}
	@media (min-width: 1024px) {
		.clients-item {
			flex-basis: calc(100cqw / 6);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.clients-track {
			width: 100%;
			flex-wrap: wrap;
			justify-content: center;
			transform: none;
			animation: none;
		}
		.clients-copy {
			display: none;
		}
		.clients-item {
			flex: 0 1 9rem;
		}
	}
</style>
