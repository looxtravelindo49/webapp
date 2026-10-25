<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		PROMO_DELAY_MS,
		PROMO_FINE,
		PROMO_SUPPRESS_KEY,
		PROMO_WA_NUMBER,
		PROMO_WA_TEXT,
		promoCopy,
		promoDismissKey,
		promoIsLive,
		type Promo
	} from '#lib/promo.js';
	import { waLink } from '#lib/whatsapp.js';

	let { promo }: { promo: Promo } = $props();

	let open = $state(false);
	let dialog = $state<HTMLDivElement | null>(null);
	let returnTo: HTMLElement | null = null;

	const copy = $derived(promoCopy(promo.conditions));
	const waHref = waLink(PROMO_WA_NUMBER, PROMO_WA_TEXT);
	const titleId = $props.id();

	function unlock() {
		document.body.style.overflow = '';
		document.body.style.paddingRight = '';
	}

	function lock() {
		const gap = window.innerWidth - document.documentElement.clientWidth;
		document.body.style.overflow = 'hidden';
		document.body.style.paddingRight = gap > 0 ? `${gap}px` : '';
	}

	function close() {
		if (!open) return;
		open = false;
		try {
			localStorage.setItem(promoDismissKey(promo), '1');
		} catch {
			// Mode privat: popup tetap bisa ditutup, hanya tidak diingat.
		}
		unlock();
		returnTo?.focus();
		returnTo = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
			return;
		}
		if (e.key !== 'Tab' || !dialog) return;
		const nodes = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
		if (nodes.length === 0) return;
		const first = nodes[0];
		const last = nodes[nodes.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || !dialog.contains(active))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	onMount(() => {
		if (!promoIsLive(promo)) return;
		try {
			if (localStorage.getItem(PROMO_SUPPRESS_KEY) === '1') return;
			if (localStorage.getItem(promoDismissKey(promo)) === '1') return;
		} catch {
			return;
		}
		const timer = window.setTimeout(async () => {
			returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			open = true;
			lock();
			await tick();
			dialog?.focus();
		}, PROMO_DELAY_MS);
		return () => {
			window.clearTimeout(timer);
			unlock();
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="print-hide fixed inset-0 z-40 flex items-end justify-center md:items-center md:p-4">
		<button type="button" class="absolute inset-0 cursor-default bg-[rgb(17_58_51/0.55)]" tabindex="-1" aria-label="Tutup promo" onclick={close}></button>
		<div
			bind:this={dialog}
			role="dialog"
			aria-modal="true"
			aria-labelledby="{titleId}-judul"
			tabindex="-1"
			class="promo-in relative z-10 grid max-h-[82vh] w-full max-w-[760px] overflow-auto rounded-t-[20px] bg-white text-green-900 shadow-[0_20px_60px_rgb(0_0_0/0.3)] outline-none md:max-h-[90vh] md:grid-cols-[1fr_1.15fr] md:overflow-hidden md:rounded-[20px]"
		>
			<div class="relative h-[130px] bg-green-100 md:h-auto md:min-h-[280px]">
				<img
					src={promo.image}
					alt={promo.imageAlt || 'Promo Lembang Adventure'}
					width="800"
					height="600"
					loading="lazy"
					decoding="async"
					fetchpriority="low"
					class="h-full w-full object-cover md:absolute md:inset-0"
				/>
			</div>
			<div class="relative px-4.5 pt-5 pb-5.5 sm:px-7 sm:py-8">
				<button
					type="button"
					class="absolute top-3 right-3 grid size-[38px] cursor-pointer place-items-center rounded-full border-0 bg-white text-[22px] leading-none text-green-900 shadow-[0_2px_8px_rgb(0_0_0/0.2)]"
					aria-label="Tutup"
					onclick={close}
				>
					<span aria-hidden="true">×</span>
				</button>
				<span class="inline-block rounded-full bg-accent px-2.5 py-1 text-xs font-bold">{promo.label}</span>
				<h2 id="{titleId}-judul" class="mt-3 text-2xl leading-tight font-black tracking-tight md:text-[30px]">
					{promo.title} <span class="text-green-800">{promo.amount}</span>
				</h2>
				{#if copy.lead}
					<p class="mt-1.5 text-[13.5px] leading-normal text-muted md:text-[14.5px]">{copy.lead}</p>
				{/if}
				{#if copy.steps.length > 0}
					<ol class="mt-3.5 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed md:text-sm">
						{#each copy.steps as step, i (i)}
							<li>{step}</li>
						{/each}
					</ol>
				{/if}
				<div class="mt-4.5 flex flex-col gap-2.5 md:flex-row">
					<a
						href="#konsultasi"
						class="flex-1 rounded-xl bg-green-900 px-3.5 py-3 text-center text-sm font-bold text-white hover:bg-green-800"
						onclick={close}
					>
						{promo.cta}
					</a>
					<a
						href={waHref}
						target="_blank"
						rel="noopener"
						class="flex-1 rounded-xl border-[1.5px] border-green-900 px-3.5 py-3 text-center text-sm font-bold text-green-900 hover:bg-cream"
					>
						Chat WhatsApp
					</a>
				</div>
				<p class="mt-3 text-[11.5px] leading-normal text-muted">{PROMO_FINE}</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.promo-in {
		animation: promo-in 0.25s ease;
	}
	@keyframes promo-in {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.promo-in {
			animation: none;
		}
	}
</style>
