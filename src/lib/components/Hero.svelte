<script lang="ts">
	import { hero } from '#lib/content/hero.js';
	import Button from './Button.svelte';

</script>

<section class="on-dark relative overflow-hidden bg-green-900 text-white">
	<div class="wrap grid items-center gap-8 pt-9 pb-12 md:grid-cols-[1.05fr_1fr] md:gap-16 md:pt-14 md:pb-16">
		<div>
			<div class="eyebrow text-accent">{hero.eyebrow}</div>
			<h1 class="my-4 text-[42px] leading-[1.13] font-black tracking-[-0.045em] sm:my-5 lg:text-[58px]">
				{#each hero.titleLines as line (line)}{line}<br />{/each}<em class="text-accent not-italic">{hero.titleEmphasis}</em>
			</h1>
			<p class="mb-6 max-w-105 text-[13px] leading-[1.9] text-green-100 sm:text-sm">{hero.description}</p>
			<div class="flex flex-wrap items-center gap-5">
				<Button variant="accent" href="#paket">Temukan ide trip <span aria-hidden="true">↗</span></Button>
				<Button variant="link" href="#konsultasi" class="text-white">Diskusi dulu, yuk</Button>
			</div>
		</div>

		<div class="relative">
			<img
				src={hero.image}
				alt={hero.imageAlt}
				width="600"
				height="440"
				fetchpriority="high"
				class="block aspect-[1.7] w-full rounded-tl-[48px] rounded-tr-[10px] rounded-b-[10px] bg-green-800 object-cover sm:aspect-[1.27] sm:rounded-tl-[85px] sm:rounded-tr-xl sm:rounded-b-xl"
			/>
			<div
				class="absolute top-2.5 right-4 -rotate-[7deg] rounded-[3px] bg-accent px-4 py-3 text-[9px] leading-normal font-extrabold text-green-900 shadow-lg shadow-black/20 sm:top-5 sm:right-auto sm:-left-7 sm:text-[10px]"
			>
				{#each hero.note as line (line)}{line}<br />{/each}
			</div>
			<a
				href="#paket"
				class="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg border border-white bg-cream/95 px-3.5 py-2.5 text-green-900 backdrop-blur-sm sm:inset-x-4.5 sm:bottom-4.5 sm:px-4.5 sm:py-4"
			>
				<div>
					<strong class="text-sm">{hero.captionTitle}</strong>
					<small class="block text-[10px] text-muted">{hero.captionText}</small>
				</div>
				<span aria-hidden="true" class="grid size-8 place-items-center rounded-full bg-green-900 text-white">↗</span>
			</a>
		</div>
	</div>

	<div class="wrap border-t border-white/15 pb-6 pt-5">
		<ul class="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[10px] text-green-100 sm:text-[11px]">
			{#each hero.promise as item (item)}
				<li><span aria-hidden="true" class="mr-2 text-accent">✓</span>{item}</li>
			{/each}
		</ul>
	</div>
</section>
