<script lang="ts">
	import { marqueeCopies, marqueeShift, splitClientRows, type ClientLogo } from '#lib/clients.js';

	let { clients }: { clients: readonly ClientLogo[] } = $props();

	function band(rows: readonly ClientLogo[], visible: number) {
		const copies = marqueeCopies(rows.length, visible);
		return {
			rows,
			copies,
			shift: marqueeShift(copies),
			loop: Array.from({ length: copies }, () => rows).flat()
		};
	}

	const desktop = $derived(band(clients, 6));
	const mobileRows = $derived(splitClientRows(clients).filter((row) => row.length > 0).map((row) => band(row, 3)));
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
		<div class="clients-desktop">
			<div class="clients-marquee" style="--clients-visible: 6">
				<ul class="clients-track" style="--clients-shift: {desktop.shift}">
					{#each desktop.loop as client, i (`d-${client.id}-${i}`)}
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
		</div>
		<div class="clients-mobile">
			{#each mobileRows as row, r (r)}
				<div class="clients-marquee" style="--clients-visible: 3">
					<ul class="clients-track" style="--clients-shift: {row.shift}">
						{#each row.loop as client, i (`m${r}-${client.id}-${i}`)}
							<li class="clients-item" class:clients-copy={i >= row.rows.length}>
								{#if client.src}
									<img src={client.src} alt="" />
								{:else}
									<span class="clients-word">{client.name}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</section>
{/if}

<style>
	.clients-mobile {
		display: grid;
		gap: 0.35rem;
	}
	.clients-desktop {
		display: none;
	}
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
		flex: 0 0 calc(100cqw / var(--clients-visible, 6));
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
	@media (min-width: 1024px) {
		.clients-mobile {
			display: none;
		}
		.clients-desktop {
			display: block;
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
