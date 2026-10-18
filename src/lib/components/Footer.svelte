<script lang="ts">
	import { site } from '#lib/content/site.js';

	const year = new Date().getFullYear();
</script>

<footer class="on-dark bg-green-900 py-9 text-white">
	<div class="wrap flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center sm:gap-8">
		<div>
			<a href="/" class="block text-[23px] leading-none font-black tracking-[-0.06em]"
				>Lembang <span class="font-medium">Adventures</span></a
			>
			<p class="mt-3 text-[11px] text-green-100">{site.byline}</p>
		</div>
		<div>
			<a href="#rencanakan" class="border-b border-accent py-1 text-xs font-bold">Bikin cerita bareng timmu ↗</a>
			<p class="mt-3 text-[11px] text-green-100">{site.activities.join(' · ')}</p>
		</div>
		<small class="text-[10px] text-green-100"
			>{site.footerNote}<br />© {year} {site.name}</small
		>
	</div>
</footer>
