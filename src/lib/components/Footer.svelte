<script lang="ts">
	import { businessAddress, site } from '#lib/content/site.js';
	import { FLOAT_WA_NUMBER, formatWhatsappDisplay } from '#lib/whatsapp.js';
	import BankAccount from './BankAccount.svelte';

	const year = new Date().getFullYear();
</script>

<footer class="print-hide on-dark bg-green-900 pt-9 pb-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.5rem))] text-white">
	<div class="wrap">
		<div class="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center sm:gap-8">
			<div>
				<a href="/" class="block text-[23px] leading-none font-black tracking-[-0.06em]"
					>Lembang <span class="font-medium">Adventure</span></a
				>
				<p class="mt-3 text-[11px] text-green-100">{site.byline}</p>
				<p class="mt-2 max-w-sm text-[11px] leading-relaxed text-green-100">
					{businessAddress.line}<br />
					<a href="https://wa.me/{FLOAT_WA_NUMBER}" class="text-green-100">WhatsApp {formatWhatsappDisplay(FLOAT_WA_NUMBER)}</a>
				</p>
			</div>
			<div>
				<a href="/#rencanakan" class="border-b border-accent py-1 text-xs font-bold">Bikin cerita bareng timmu ↗</a>
				<p class="mt-3 text-[11px] text-green-100">{site.activities.join(' · ')}</p>
			</div>
			<small class="text-[10px] text-green-100"
				>{site.footerNote}<br />© {year} {site.name}</small
			>
		</div>
		<div class="mt-6 border-t border-white/15 pt-6">
			<BankAccount tone="dark" />
			<p class="mt-4 text-[11px]">
				<a href="/kebijakan-pembayaran" class="border-b border-accent py-1 font-bold">Kebijakan pembayaran</a>
			</p>
		</div>
	</div>
</footer>
