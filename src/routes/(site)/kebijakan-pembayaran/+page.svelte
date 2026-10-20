<script lang="ts">
	import Seo from '#lib/components/Seo.svelte';
	import { paymentPolicy } from '#lib/content/payment-policy.js';
	import { shareImage } from '#lib/seo.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	siteUrl={data.siteUrl}
	path="/kebijakan-pembayaran"
	title={paymentPolicy.title}
	description={paymentPolicy.description}
	image={shareImage(data.siteUrl)}
/>

<section class="wrap max-w-3xl py-11 sm:py-16">
	<div class="eyebrow">Loox Travel</div>
	<h1 class="my-3 text-[32px] leading-tight font-black tracking-tight sm:text-4xl">{paymentPolicy.title}</h1>
	<p class="max-w-xl text-xs leading-[1.9] text-muted sm:text-[13px]">{paymentPolicy.intro}</p>

	<ol class="mt-8 grid gap-4">
		{#each paymentPolicy.sections as section, i (section.title)}
			<li class="rounded-xl border border-line bg-white p-5 sm:p-6">
				<h2 class="text-sm font-black tracking-tight">{i + 1}. {section.title}</h2>
				<p class="mt-2 text-xs leading-[1.9] sm:text-[13px]">{section.body}</p>
			</li>
		{/each}
	</ol>
</section>
