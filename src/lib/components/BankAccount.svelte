<script lang="ts">
	import { bank, bankLogo } from '#lib/content/bank.js';

	let { tone = 'light' }: { tone?: 'light' | 'dark' } = $props();
	const dark = $derived(tone === 'dark');
</script>

<section aria-label="Rekening resmi" class={dark ? 'text-green-100' : 'text-green-900'}>
	<p class="eyebrow {dark ? 'text-accent' : 'text-muted'}">Rekening resmi</p>
	<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
		<img
			src={bankLogo.src}
			alt={bankLogo.alt}
			width={bankLogo.width}
			height={bankLogo.height}
			class="h-8 w-auto max-w-full shrink-0 rounded-sm bg-white sm:h-10"
		/>
		<div class="min-w-0">
			<p class="text-xs font-bold {dark ? 'text-white' : ''}">{bank.bank}</p>
			<p class="text-sm font-black tracking-wide {dark ? 'text-white' : ''}">{bank.account}</p>
			<p class="text-[11px]">a/n {bank.holder}</p>
		</div>
	</div>
	<p class="mt-3 max-w-xl text-[11px] leading-[1.7]">{bank.warning}</p>
</section>
