<script lang="ts">
	import BankAccount from '#lib/components/BankAccount.svelte';
	import Button from '#lib/components/Button.svelte';
	import { paymentPolicyPath, paymentPolicySummary } from '#lib/content/payment-policy.js';
	import { site } from '#lib/content/site.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function printInvoice() {
		window.print();
	}
</script>

<svelte:head>
	<title>{data.title} {data.nomor} | {site.name}</title>
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

<article class="invoice-sheet wrap relative my-8 max-w-3xl rounded-xl border border-line bg-white p-5 text-green-900 sm:my-12 sm:p-8">
	<header class="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
		<div>
			<p class="text-[11px] font-bold tracking-[0.14em] uppercase text-muted">{site.name}</p>
			<h1 class="mt-1 text-2xl font-black tracking-tight">{data.title}</h1>
			<p class="mt-1 text-sm font-bold">{data.nomor}</p>
		</div>
		<div class="text-left sm:text-right">
			<p class="text-[11px] text-muted">Dibuat {data.createdLabel}</p>
			{#if data.stamp}
				<p
					class="mt-2 inline-block rounded-md border-4 border-green-900 px-3 py-1 text-3xl leading-none font-black tracking-[0.18em] text-green-900 sm:text-4xl"
				>
					LUNAS
				</p>
				{#if data.paidDateLabel}
					<p class="mt-2 text-xs font-bold">Dibayar {data.paidDateLabel}</p>
				{/if}
			{:else}
				<p class="mt-1 inline-block rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold">{data.badge}</p>
				{#if data.status === 'dp_diterima' && data.paidDateLabel}
					<p class="mt-1 text-[11px] text-muted">Diterima {data.paidDateLabel}</p>
				{/if}
			{/if}
		</div>
	</header>

	{#if data.status === 'baru'}
		<p class="mt-5 text-xs leading-[1.8] text-muted">
			Ini estimasi, bukan tagihan final. Harga finalnya kami konfirmasi lewat WhatsApp.
		</p>
	{:else if data.status === 'batal'}
		<p class="mt-5 text-xs leading-[1.8] text-muted">Invoice ini dibatalkan.</p>
	{:else if data.status === 'lunas'}
		<p class="mt-5 text-xs leading-[1.8] text-muted">Pembayaran invoice ini sudah lunas.</p>
	{:else}
		<p class="mt-5 text-xs leading-[1.8] text-muted">DP sudah kami terima. Sisa tagihannya ada di samping total.</p>
	{/if}

	<dl class="mt-5 grid gap-3 text-xs sm:grid-cols-2">
		<div>
			<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Nama PIC / Perusahaan</dt>
			<dd class="font-bold">{data.nama}</dd>
		</div>
		{#if data.perusahaan}
			<div>
				<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Perusahaan</dt>
				<dd class="font-bold">{data.perusahaan}</dd>
			</div>
		{/if}
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
		{#each data.lines as line (line.key)}
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
			{#if data.subtotalLabel}
				<p class="text-[11px] text-muted">Subtotal {data.subtotalLabel}</p>
				<p class="text-[11px] text-muted">Diskon − {data.diskonLabel}</p>
			{/if}
			<p class="text-[10px] font-bold tracking-wider text-muted uppercase">{data.totalLabel}</p>
			<p class="text-2xl font-black tracking-tight">{data.estimasiLabel}</p>
			{#if data.perPaxLabel}<p class="text-[11px] font-bold text-muted">{data.perPaxLabel}</p>{/if}
			{#if data.estimasiNote}<p class="text-[11px] text-muted">{data.estimasiNote}</p>{/if}
		</div>
		{#if data.status === 'dp_diterima'}
			<div class="text-left sm:text-right">
				<p class="text-[10px] font-bold tracking-wider text-muted uppercase">DP diterima</p>
				<p class="text-lg font-black">{data.paidLabel ?? 'Nominal menyusul'}</p>
				<p class="mt-2 text-[10px] font-bold tracking-wider text-muted uppercase">Sisa tagihan</p>
				<p class="text-lg font-black">{data.remainingLabel ?? 'Menyusul'}</p>
			</div>
		{:else if data.showPayCta}
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
		{:else if data.status === 'lunas' && data.paidLabel}
			<div class="text-left sm:text-right">
				<p class="text-[10px] font-bold tracking-wider text-muted uppercase">Jumlah diterima</p>
				<p class="text-lg font-black">{data.paidLabel}</p>
			</div>
		{/if}
	</div>

	<p class="mt-4 text-[11px] leading-[1.8] text-muted">
		{paymentPolicySummary}{' '}
		<a href={paymentPolicyPath} class="font-bold text-green-900 underline">Kebijakan pembayaran</a>
	</p>

	{#if data.showPayCta}
		<div class="mt-6 rounded-lg bg-cream px-4 py-3 text-xs leading-[1.8]">
			<p class="font-bold">Cara bayar sekarang</p>
			<p class="mt-1">
				Transfer ke rekening PT: CIMB Niaga Syariah 860025788700 a/n Loox Travel Luxury. Setelah kamu transfer, kirim bukti lewat WhatsApp dan cantumkan nomor invoice {data.nomor}.
			</p>
		</div>
	{/if}

	<div class="no-print mt-6 flex flex-wrap gap-2.5">
		<Button type="button" variant="outline" onclick={printInvoice}>Cetak atau simpan</Button>
		{#if data.proofUrl}
			<Button href={data.proofUrl} variant="accent" target="_blank" rel="noopener noreferrer">
				Kirim bukti transfer <span aria-hidden="true">↗</span>
			</Button>
		{/if}
		{#if data.waUrl}
			<Button href={data.waUrl} variant="outline" target="_blank" rel="noopener noreferrer">
				Konfirmasi via WhatsApp <span aria-hidden="true">↗</span>
			</Button>
		{/if}
		{#if data.showPayCta}
			<Button type="button" variant="outline" disabled>Bayar DP {data.dpPercent}% (segera)</Button>
		{/if}
	</div>
	{#if data.showPayCta}
		<p class="no-print mt-3 text-[11px] text-muted">
			Estimasi kamu sudah kami simpan. Pembayaran DP online segera hadir. Untuk sekarang, transfer ke rekening PT lalu kirim buktinya lewat WhatsApp.
		</p>
	{/if}

	<div class="mt-8 border-t border-line pt-6">
		<BankAccount />
	</div>
</article>
