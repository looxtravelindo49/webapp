<script lang="ts">
	import { GOOGLE_MAP_EMBED_URL, GOOGLE_REVIEWS_URL, type PublicReview } from '#lib/content/reviews.js';

	let { reviews, summary = null, showMap = false }: { reviews: PublicReview[]; summary?: string | null; showMap?: boolean } = $props();

	const stars = (rating: number) => '★★★★★☆☆☆☆☆'.slice(5 - rating, 10 - rating);
</script>

{#if reviews.length > 0}
	<section id="ulasan" class="wrap py-11 sm:py-16" aria-labelledby="ulasan-judul">
		<div class="mb-6 max-w-xl sm:mb-8">
			<div class="eyebrow">Ulasan</div>
			<h2 id="ulasan-judul" class="my-2 text-[26px] leading-tight font-black tracking-tight sm:text-[30px]">Ulasan dari Google</h2>
			{#if summary}<p class="text-sm font-black tracking-tight">{summary}</p>{/if}
		</div>
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each reviews as review (review.id)}
				<li class="flex flex-col rounded-xl border border-line bg-white p-5">
					<p class="text-sm tracking-wide text-accent-700" aria-label="{review.rating} dari 5">{stars(review.rating)}</p>
					<blockquote class="mt-3 flex-1 text-xs leading-[1.8]">{review.text}</blockquote>
					<footer class="mt-4 text-[11px] text-muted">
						<strong class="font-bold text-green-900">{review.name}</strong>
						{#if review.date}<span> · {review.date}</span>{/if}
						{#if review.url}
							<a href={review.url} class="mt-1 block font-bold text-green-900 underline" target="_blank" rel="noopener noreferrer">Lihat ulasan</a>
						{/if}
					</footer>
				</li>
			{/each}
		</ul>
		<div class="mt-6 flex flex-wrap gap-x-6 gap-y-2">
			<a href={GOOGLE_REVIEWS_URL} class="inline-flex border-b border-accent py-1 text-xs font-bold" target="_blank" rel="noopener noreferrer">Lihat semua ulasan di Google</a>
			<a href={GOOGLE_REVIEWS_URL} class="inline-flex border-b border-accent py-1 text-xs font-bold" target="_blank" rel="noopener noreferrer">Tulis ulasan</a>
		</div>
		{#if showMap}
			<iframe
				title="Peta Loox Travel di Google Maps"
				src={GOOGLE_MAP_EMBED_URL}
				class="mt-8 h-72 w-full rounded-xl border border-line"
				loading="lazy"
				referrerpolicy="no-referrer-when-downgrade"
				allowfullscreen
			></iframe>
		{/if}
	</section>
{/if}
