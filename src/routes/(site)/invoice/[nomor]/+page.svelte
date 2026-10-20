<script lang="ts">
	import BankAccount from '#lib/components/BankAccount.svelte';
	import Button from '#lib/components/Button.svelte';
	import { site } from '#lib/content/site.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function printInvoice() {
		window.print();
	}
</script>

<svelte:head>
	<title>Invoice {data.nomor} | {site.name}</title>
	<meta name="robots" content="noindex, nofollow" />
	<style>
		@media print {
			.print-hide,
			.no-print {
				display: none !important;
			}
			body {
				background: #fff !important;
			}
			.invoice-sheet {
				border: 0 !important;
				box-shadow: none !important;
			}
		}
	</style>
</svelte:head>

<article class="invoice-sheet wrap my-8 max-w-3xl rounded-xl border border-line bg-white p-5 text-green-900 sm:my-12 sm:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
		<div>
			<p class="text-[11px] font-bold tracking-[0.14em] uppercase text-muted">{site.name}</p>
			<h1 class="mt-1 text-2xl font-black tracking-tight">Invoice estimasi</h1>
			<p class="mt-1 text-sm font-bold">{data.nomor}</p>
		</div>
		<div class="text-left sm:text-right">
			<p class="text-[11px] text-muted">Dibuat {data.createdLabel}</p>
			<p class="mt-1 inline-block rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold">{data.statusLabel}</p>
		</div>
	</header>

	<p class="mt-5 text-xs leading-[1.8] text-muted">
		Ini estimasi, bukan tagihan final. Harga finalnya kami konfirmasi lewat WhatsApp.
	</p>

	<dl class="mt-5 grid gap-3 text-xs sm:grid-cols-2">
		<div>
			<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Nama</dt>
			<dd class="font-bold">{data.nama}</dd>
		</div>
		<div>
			<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">WhatsApp</dt>
			<dd class="font-bold">{data.whatsapp}</dd>
		</div>
		<div>
			<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Peserta</dt>
			<dd class="font-bold">{data.pax.toLocaleString('id-ID')} orang</dd>
		</div>
		<div>
			<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Tanggal acara</dt>
			<dd class="font-bold">{data.tanggalLabel}</dd>
		</div>
		{#if data.catatan}
			<div class="sm:col-span-2">
				<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Catatan</dt>
				<dd class="whitespace-pre-wrap">{data.catatan}</dd>
			</div>
		{/if}
	</dl>

	<ul class="mt-6 divide-y divide-line border-y border-line">
		{#each data.lines as line (line.title)}
			<li class="flex items-start justify-between gap-4 py-3">
				<div class="min-w-0">
					<p class="text-xs font-bold">{line.title}</p>
					<p class="text-[11px] text-muted">{line.detail}</p>
				</div>
				<p class="shrink-0 text-xs font-bold">{line.amount}</p>
			</li>
		{/each}
	</ul>

	<div class="mt-4 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="text-[10px] font-bold tracking-wider text-muted uppercase">Total estimasi</p>
			<p class="text-2xl font-black tracking-tight">{data.estimasiLabel}</p>
			{#if data.estimasiNote}<p class="text-[11px] text-muted">{data.estimasiNote}</p>{/if}
		</div>
		<div class="text-left sm:text-right">
			<p class="text-[10px] font-bold tracking-wider text-muted uppercase">Uang muka (DP) {data.dpPercent}%</p>
			{#if data.dpLabel}
				<p class="text-lg font-black">{data.dpLabel}</p>
			{:else}
				<p class="max-w-xs text-[11px] text-muted">
					Nominal DP {data.dpPercent}% muncul setelah estimasinya berupa angka.
				</p>
			{/if}
		</div>
	</div>

	<div class="no-print mt-6 flex flex-wrap gap-2.5">
		<Button type="button" variant="outline" onclick={printInvoice}>Cetak atau simpan</Button>
		{#if data.waUrl}
			<Button href={data.waUrl} variant="accent" target="_blank" rel="noopener noreferrer">
				Konfirmasi via WhatsApp <span aria-hidden="true">↗</span>
			</Button>
		{/if}
		<Button type="button" variant="outline" disabled>Bayar DP {data.dpPercent}% (segera)</Button>
	</div>
	<p class="no-print mt-3 text-[11px] text-muted">
		Estimasi kamu sudah kami simpan. Kalau chat WhatsApp belum terbuka, ketuk tombol di atas. Pembayaran DP online segera hadir.
	</p>

	<div class="mt-8 border-t border-line pt-6">
		<BankAccount />
	</div>
</article>
