<script lang="ts">
	import { articles, articlesSection as s, type Article } from '#lib/content/articles.js';
	import { paragraphs } from '#lib/text.js';
	import Dialog from './Dialog.svelte';

	let open = $state(false);
	let current = $state<Article>(articles[0]);

	function show(a: Article) {
		current = a;
		open = true;
	}
</script>

<section id="inspirasi" class="wrap py-11 sm:py-16">
	<div class="mb-6 sm:mb-7">
		<div class="eyebrow">{s.eyebrow}</div>
		<h2 class="my-2 text-[26px] leading-tight font-black tracking-tight sm:text-[30px]">{s.title}</h2>
		<p class="text-[11px] text-muted sm:text-xs">{s.sub}</p>
	</div>

	<div class="grid gap-x-6 sm:grid-cols-3">
		{#each articles as a (a.title)}
			<button
				type="button"
				onclick={() => show(a)}
				aria-haspopup="dialog"
				class="group flex w-full cursor-pointer flex-col items-start justify-start border-0 border-t border-line bg-white py-4 text-left sm:py-5"
			>
				<small class="text-[9px] tracking-[0.15em] text-muted">{a.category}</small>
				<h3 class="mt-2.5 mb-4 text-[19px] leading-[1.55] font-bold tracking-tight group-hover:text-green-800 sm:text-[17px]">
					{a.title}
				</h3>
				<span class="text-[11px] font-bold">Baca selengkapnya ↗</span>
			</button>
		{/each}
	</div>
</section>

<Dialog bind:open title={current.title} label={current.category}>
	{#each paragraphs(current.body) as p (p)}
		<p class="mb-4 text-[13px] leading-[1.9]">{p}</p>
	{/each}
</Dialog>
