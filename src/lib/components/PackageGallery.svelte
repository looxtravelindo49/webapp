<script lang="ts">
	import { slideAlt, stepGallery, swipeDirection, thumbnailIndexes, GALLERY_INTERVAL_MS } from '#lib/gallery.js';

	export type GallerySlide = { src: string; alt: string | null };

	let {
		photos,
		fallbackAlt,
		running = true
	}: {
		photos: GallerySlide[];
		fallbackAlt: string;
		/** False saat panel tab disembunyikan: indeks kembali ke foto pertama dan geser otomatis berhenti. */
		running?: boolean;
	} = $props();

	let index = $state(0);
	let hover = $state(false);
	let touching = $state(false);
	let reduce = $state(false);

	const selected = $derived(photos.length === 0 ? 0 : ((index % photos.length) + photos.length) % photos.length);
	const current = $derived(photos[selected]);
	const thumbs = $derived(thumbnailIndexes(photos.length, selected));

	let track = false;
	let originX = 0;
	let originY = 0;

	$effect(() => {
		if (!running) {
			index = 0;
			hover = false;
			touching = false;
			track = false;
			return;
		}
		if (reduce || hover || touching || photos.length < 2) return;
		const n = photos.length;
		const timer = setInterval(() => {
			index = stepGallery(index, n, 1);
		}, GALLERY_INTERVAL_MS);
		return () => clearInterval(timer);
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduce = mq.matches;
		const sync = () => {
			reduce = mq.matches;
		};
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	function onEnter(e: PointerEvent) {
		if (e.pointerType === 'mouse') hover = true;
	}
	function onLeave(e: PointerEvent) {
		if (e.pointerType === 'mouse') hover = false;
	}
	function onDown(e: PointerEvent) {
		if (e.pointerType !== 'mouse') touching = true;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if ((e.target as HTMLElement | null)?.closest('button')) {
			track = false;
			return;
		}
		track = true;
		originX = e.clientX;
		originY = e.clientY;
		const section = e.currentTarget as HTMLElement;
		if (section.setPointerCapture) section.setPointerCapture(e.pointerId);
	}
	function onUp(e: PointerEvent) {
		if (e.pointerType !== 'mouse') touching = false;
		if (!track) return;
		track = false;
		const dir = swipeDirection(e.clientX - originX, e.clientY - originY);
		if (dir) index = stepGallery(index, photos.length, dir);
	}
	function onCancel() {
		touching = false;
		track = false;
	}
</script>

{#if current}
	<section
		class="grid touch-pan-y gap-3"
		aria-label="Galeri foto"
		data-autoplay-ms={running && photos.length > 1 ? GALLERY_INTERVAL_MS : undefined}
		onpointerenter={onEnter}
		onpointerleave={onLeave}
		onpointerdown={onDown}
		onpointerup={onUp}
		onpointercancel={onCancel}
	>
		<img
			src={current.src}
			alt={slideAlt(current.alt, fallbackAlt)}
			width="960"
			height="720"
			loading="eager"
			draggable="false"
			class="aspect-[4/3] w-full rounded-2xl bg-cream object-cover"
		/>
		{#if thumbs.length > 0}
			<ul class="grid grid-cols-3 gap-2 sm:gap-3">
				{#each thumbs as i (photos[i].src + ':' + i)}
					<li>
						<button
							type="button"
							class="block w-full cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
							aria-label="Tampilkan {slideAlt(photos[i].alt, fallbackAlt)}"
							onclick={() => (index = i)}
						>
							<img
								src={photos[i].src}
								alt={slideAlt(photos[i].alt, fallbackAlt)}
								width="320"
								height="240"
								loading="lazy"
								draggable="false"
								class="aspect-[4/3] w-full rounded-xl bg-cream object-cover"
							/>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
