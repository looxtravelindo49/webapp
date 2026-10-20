<script lang="ts">
	import { bank } from '#lib/content/bank.js';

	let { tone = 'light' }: { tone?: 'light' | 'dark' } = $props();
	const dark = $derived(tone === 'dark');
</script>

<section aria-label="Rekening resmi" class={dark ? 'text-green-100' : 'text-green-900'}>
	<p class="eyebrow {dark ? 'text-accent' : 'text-muted'}">Rekening resmi</p>
	<div class="mt-3 flex items-center gap-4">
		<!-- Wordmark teks. Ganti dengan file logo resmi CIMB Niaga Syariah bila sudah ada; jangan ambil dari sumber acak. -->
		<div
			class="grid h-14 w-28 shrink-0 place-items-center rounded-md border border-line bg-white px-2 text-center text-green-900"
			role="img"
			aria-label="CIMB Niaga Syariah"
		>
			<span class="text-[11px] leading-none font-black tracking-tight">CIMB Niaga</span>
			<span class="mt-1 text-[8px] leading-none font-bold tracking-[0.16em] uppercase">Syariah</span>
		</div>
		<div class="min-w-0">
			<p class="text-xs font-bold {dark ? 'text-white' : ''}">{bank.bank}</p>
			<p class="text-sm font-black tracking-wide {dark ? 'text-white' : ''}">{bank.account}</p>
			<p class="text-[11px]">a/n {bank.holder}</p>
		</div>
	</div>
	<p class="mt-3 max-w-xl text-[11px] leading-[1.7]">{bank.warning}</p>
</section>
