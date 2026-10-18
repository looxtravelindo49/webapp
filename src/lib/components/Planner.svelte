<script lang="ts">
	import { planner } from '#lib/content/planner.js';
	import Button from './Button.svelte';

</script>

<section id="rencanakan" class="wrap pt-11 sm:pt-16">
	<div
		class="on-dark grid items-center gap-6.5 rounded-xl bg-green-900 p-6 text-white sm:p-8 md:grid-cols-[1.1fr_1fr] md:gap-16 md:px-11.5 md:py-10.5"
	>
		<div>
			<div class="eyebrow text-accent">{planner.eyebrow}</div>
			<h2 class="my-3 text-[27px] leading-tight font-black tracking-tight sm:text-[32px]">
				{planner.titleLines[0]}<br />{planner.titleLines[1]}
			</h2>
			<p class="mb-5.5 max-w-100 text-xs text-green-100">{planner.text}</p>
			<Button variant="accent" href="#konsultasi">{planner.cta} <span aria-hidden="true">↗</span></Button>
		</div>
		<ol class="grid gap-4">
			{#each planner.steps as step, i (step.title)}
				<li class="flex items-center gap-4 border-b border-white/15 pb-4 last:border-0 last:pb-0">
					<span
						class="grid size-9 shrink-0 place-items-center rounded-full border border-white/30 text-xs text-accent"
						aria-hidden="true">{String(i + 1).padStart(2, '0')}</span
					>
					<div>
						<strong class="block text-xs">{step.title}</strong>
						<small class="text-[10px] text-green-100">{step.text}</small>
					</div>
				</li>
			{/each}
		</ol>
	</div>
</section>
