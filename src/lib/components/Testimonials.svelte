<script lang="ts">
	import { GOOGLE_REVIEWS_URL, type PublicReview } from '#lib/content/reviews.js';

	let { reviews }: { reviews: PublicReview[] } = $props();

	const stars = (rating: number) => '★★★★★☆☆☆☆☆'.slice(5 - rating, 10 - rating);
</script>

{#if reviews.length > 0}
	<section id="ulasan" class="wrap py-11 sm:py-16" aria-labelledby="ulasan-judul">
		<div class="mb-6 max-w-xl sm:mb-8">
			<div class="eyebrow">Ulasan</div>
			<h2 id="ulasan-judul" class="my-2 text-[26px] leading-tight font-black tracking-tight sm:text-[30px]">Kata tamu</h2>
			<p class="text-[11px] leading-relaxed text-muted sm:text-xs">Ulasan dari Google Business Profile Loox Travel Lembang Bandung.</p>
		</div>
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each reviews as review (review.id)}
				<li class="flex flex-col rounded-xl border border-line bg-white p-5">
					<p class="text-sm tracking-wide text-accent-700" aria-label="{review.rating} dari 5">{stars(review.rating)}</p>
					<blockquote class="mt-3 flex-1 text-xs leading-[1.8]">{review.text}</blockquote>
					<footer class="mt-4 text-[11px] text-muted">
						<strong class="font-bold text-green-900">{review.name}</strong>
						<span> · {review.date}</span>
						{#if review.url}
							<a href={review.url} class="mt-1 block font-bold text-green-900 underline" target="_blank" rel="noopener noreferrer">Lihat ulasan</a>
						{/if}
					</footer>
				</li>
			{/each}
		</ul>
		<p class="mt-6">
			<a href={GOOGLE_REVIEWS_URL} class="inline-flex border-b border-accent py-1 text-xs font-bold" target="_blank" rel="noopener noreferrer">Lihat semua ulasan di Google</a>
		</p>
	</section>
{/if}
