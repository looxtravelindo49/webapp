<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { GOOGLE_REVIEWS_URL, type PublicReview } from '#lib/content/reviews.js';

	let { reviews, summary = null }: { reviews: PublicReview[]; summary?: string | null } = $props();

	const uid = $props.id();
	let scroller = $state<HTMLUListElement | null>(null);
	let index = $state(0);
	let perView = $state(1);
	let hoverPaused = $state(false);
	let touchPaused = $state(false);
	let reduceMotion = $state(false);
	let hidden = $state(false);
	let expanded = $state<Record<string, boolean>>({});
	let overflows = $state<Record<string, boolean>>({});
	let lock = 0;

	const paused = $derived(hoverPaused || touchPaused);
	const pages = $derived(Math.max(1, reviews.length - perView + 1));
	const safe = $derived(Math.min(index, pages - 1));
	const stars = (rating: number) => '★★★★★☆☆☆☆☆'.slice(5 - rating, 10 - rating);

	function reduced() {
		return reduceMotion;
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

	function go(i: number) {
		const n = pages;
		if (n <= 1) return;
		const next = ((i % n) + n) % n;
		index = next;
		scrollToSlide(next);
	}

	function sync() {
		const el = scroller;
		if (!el || lock || el.children.length === 0) return;
		const width = (el.children[0] as HTMLElement).offsetWidth;
		if (width <= 0) return;
		const max = Math.max(0, reviews.length - perView);
		const next = Math.max(0, Math.min(max, Math.round(el.scrollLeft / width)));
		if (next !== index) index = next;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			go(safe + 1);
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			go(safe - 1);
		}
	}

	function onPointerDown(e: PointerEvent) {
		if (e.pointerType !== 'touch') return;
		touchPaused = true;
		const end = () => {
			touchPaused = false;
			window.removeEventListener('pointerup', end);
			window.removeEventListener('pointercancel', end);
		};
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
	}

	function measure(node: HTMLElement, id: string) {
		const check = () => {
			if (!node.classList.contains('line-clamp-5')) return;
			overflows[id] = node.scrollHeight > node.clientHeight + 1;
		};
		check();
		const ro = new ResizeObserver(check);
		ro.observe(node);
		return { destroy: () => ro.disconnect() };
	}

	function toggle(id: string) {
		expanded[id] = !expanded[id];
	}

	$effect(() => {
		const wide = window.matchMedia('(min-width: 1024px)');
		const mid = window.matchMedia('(min-width: 640px)');
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const apply = () => {
			perView = wide.matches ? 3 : mid.matches ? 2 : 1;
			reduceMotion = motion.matches;
		};
		const onVis = () => {
			hidden = document.hidden;
		};
		apply();
		onVis();
		wide.addEventListener('change', apply);
		mid.addEventListener('change', apply);
		motion.addEventListener('change', apply);
		document.addEventListener('visibilitychange', onVis);
		return () => {
			wide.removeEventListener('change', apply);
			mid.removeEventListener('change', apply);
			motion.removeEventListener('change', apply);
			document.removeEventListener('visibilitychange', onVis);
		};
	});

	$effect(() => {
		const view = perView;
		const el = scroller;
		if (!el) return;
		untrack(() => {
			const max = Math.max(0, reviews.length - view);
			const i = Math.min(index, max);
			if (i !== index) index = i;
			scrollToSlide(i);
		});
	});

	$effect(() => {
		const current = safe;
		if (pages <= 1 || paused || reduceMotion || hidden) return;
		const timer = window.setInterval(() => go(current + 1), 5000);
		return () => window.clearInterval(timer);
	});
</script>

{#if reviews.length > 0}
	<section id="ulasan" class="wrap py-11 sm:py-16" aria-labelledby="ulasan-judul">
		<div class="mb-6 max-w-xl sm:mb-8">
			<div class="eyebrow">Ulasan</div>
			<h2 id="ulasan-judul" class="my-2 text-[26px] leading-tight font-black tracking-tight sm:text-[30px]">Ulasan dari Google</h2>
			{#if summary}<p class="text-sm font-black tracking-tight">{summary}</p>{/if}
		</div>

			<!-- Pola carousel: region ini menerima panah keyboard, jadi tabindex dan onkeydown disengaja. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				role="region"
				aria-roledescription="carousel"
				aria-label="Ulasan dari Google"
				tabindex="0"
				onkeydown={onKey}
				onmouseenter={() => (hoverPaused = true)}
				onmouseleave={() => (hoverPaused = false)}
				onpointerdown={onPointerDown}
				class="rounded-xl outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
			>
				<ul
					bind:this={scroller}
					onscroll={sync}
					class="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{#each reviews as review, i (review.id)}
						<li
							id="{uid}-ulasan-{review.id}"
							class="w-full shrink-0 snap-start px-1.5 sm:w-1/2 lg:w-1/3"
							role="group"
							aria-roledescription="slide"
							aria-label="{i + 1} dari {reviews.length}: {review.name}"
						>
							<article class="flex h-full flex-col rounded-xl border border-line bg-white p-5">
								<p class="text-sm tracking-wide text-accent-700" aria-label="{review.rating} dari 5">{stars(review.rating)}</p>
								<h3 class="mt-3 text-sm font-black text-green-900">{review.name}</h3>
								<p class="mt-1 text-[11px] font-bold tracking-wide text-muted">Ulasan Google</p>
								<blockquote
									use:measure={review.id}
									class="mt-3 flex-1 text-xs leading-[1.8] whitespace-pre-line {expanded[review.id] ? '' : 'line-clamp-5'}"
								>{review.text}</blockquote>
								{#if expanded[review.id] || overflows[review.id] || review.text.length > 160 || review.text.includes('\n')}
									<button type="button" class="mt-3 self-start text-xs font-bold underline" onclick={() => toggle(review.id)}>
										{expanded[review.id] ? 'Tutup' : 'Baca selengkapnya'}
									</button>
								{/if}
							</article>
						</li>
					{/each}
				</ul>
			{#if pages > 1}
				<div class="mt-5 flex items-center justify-center gap-4">
					<button
						type="button"
						class="inline-flex size-10 items-center justify-center rounded-full border border-line bg-white text-xl leading-none font-bold text-green-900"
						aria-label="Ulasan sebelumnya"
						onclick={() => go(safe - 1)}
					>
						<span aria-hidden="true">‹</span>
					</button>
					<div class="flex items-center gap-2">
						{#each Array.from({ length: pages }, (_, i) => i) as i (i)}
							<button
								type="button"
								class="size-2.5 rounded-full {i === safe ? 'bg-green-900' : 'bg-line'}"
								aria-label="Ulasan {i + 1}"
								aria-current={i === safe ? 'true' : undefined}
								onclick={() => go(i)}
							></button>
						{/each}
					</div>
					<button
						type="button"
						class="inline-flex size-10 items-center justify-center rounded-full border border-line bg-white text-xl leading-none font-bold text-green-900"
						aria-label="Ulasan berikutnya"
						onclick={() => go(safe + 1)}
					>
						<span aria-hidden="true">›</span>
					</button>
				</div>
			{/if}
			</div>

		<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
			<Button href={GOOGLE_REVIEWS_URL} variant="outline" class="!px-6 !py-3.5 !text-sm" target="_blank" rel="noopener noreferrer">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" class="size-5 shrink-0" aria-hidden="true">
					<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
					<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
					<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
					<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
				</svg>
				Lihat semua ulasan di Google
			</Button>
			<Button href={GOOGLE_REVIEWS_URL} variant="accent" class="!px-6 !py-3.5 !text-sm" target="_blank" rel="noopener noreferrer">Tulis ulasan</Button>
		</div>
	</section>
{/if}
