<script lang="ts">
	import '@fontsource/urbanist/latin-400.css';
	import '@fontsource/urbanist/latin-600.css';
	import '@fontsource/urbanist/latin-700.css';
	import '@fontsource/urbanist/latin-800.css';
	import '#lib/invoice-print.css';
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
</svelte:head>

<article class="invoice-sheet">
	<div class="invoice-brand-bar">
		<div>
			<p class="invoice-brand-name">{site.name}</p>
			<p class="invoice-brand-byline">{site.byline}</p>
		</div>
		<p class="invoice-brand-mark">Invoice</p>
	</div>

	<div class="invoice-body">
		<header class="invoice-head invoice-keep">
			<div>
				<p class="invoice-kicker">{site.name}</p>
				<h1>{data.title}</h1>
				<p class="invoice-number">{data.nomor}</p>
			</div>
			<div class="invoice-meta-side">
				<p class="invoice-date">Dibuat {data.createdLabel}</p>
				{#if data.stamp}
					<p class="invoice-stamp">LUNAS</p>
					{#if data.paidDateLabel}
						<p class="invoice-paid-date">Dibayar {data.paidDateLabel}</p>
					{/if}
				{:else}
					<p class="invoice-badge rounded-full">{data.badge}</p>
					{#if data.status === 'dp_diterima' && data.paidDateLabel}
						<p class="invoice-paid-date">Diterima {data.paidDateLabel}</p>
					{/if}
				{/if}
			</div>
		</header>

		{#if data.status === 'baru'}
			<p class="invoice-note">Ini estimasi, bukan tagihan final. Harga finalnya kami konfirmasi lewat WhatsApp.</p>
		{:else if data.status === 'batal'}
			<p class="invoice-note">Invoice ini dibatalkan.</p>
		{:else if data.status === 'lunas'}
			<p class="invoice-note">Pembayaran invoice ini sudah lunas.</p>
		{:else}
			<p class="invoice-note">DP sudah kami terima. Sisa tagihannya ada di samping total.</p>
		{/if}

		<dl class="invoice-parties invoice-keep">
			<div>
				<dt>Nama PIC / Perusahaan</dt>
				<dd>{data.nama}</dd>
			</div>
			{#if data.perusahaan}
				<div>
					<dt>Perusahaan</dt>
					<dd>{data.perusahaan}</dd>
				</div>
			{/if}
			<div>
				<dt>WhatsApp</dt>
				<dd>{data.whatsapp}</dd>
			</div>
			<div>
				<dt>Peserta</dt>
				<dd>{data.pax.toLocaleString('id-ID')} orang</dd>
			</div>
			<div>
				<dt>Tanggal acara</dt>
				<dd>{data.tanggalLabel}</dd>
			</div>
			{#if data.catatan}
				<div>
					<dt>Catatan</dt>
					<dd class="whitespace-pre-wrap font-normal">{data.catatan}</dd>
				</div>
			{/if}
		</dl>

		<table class="invoice-table">
			<thead>
				<tr>
					<th>Deskripsi</th>
					<th class="num">Jumlah</th>
				</tr>
			</thead>
			<tbody>
				{#each data.lines as line (line.key)}
					<tr class="invoice-line">
						<td>
							<p class="invoice-line-title">{line.title}</p>
							{#if line.detail}<p class="invoice-line-detail">{line.detail}</p>{/if}
							{#if line.includes.length > 0}
								<p class="invoice-include-label">Include</p>
								<ul class="invoice-include">
									{#each line.includes as item, index (`${line.key}-${index}`)}
										<li>{item}</li>
									{/each}
								</ul>
							{/if}
						</td>
						<td>
							<p class="invoice-amount">{line.amount}</p>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div class="invoice-totals invoice-keep">
			<div>
				{#if data.subtotalLabel}<p class="invoice-sum">Subtotal {data.subtotalLabel}</p>{/if}
				{#if data.diskonLabel}<p class="invoice-sum">Diskon − {data.diskonLabel}</p>{/if}
				{#if data.fee}
					<p class="invoice-fee">{data.fee.label} <span>{data.fee.detail}</span> {data.fee.amount}</p>
				{/if}
				<p class="invoice-total-label">{data.totalLabel}</p>
				<p class="invoice-total-figure">{data.estimasiLabel}</p>
				{#if data.perPaxLabel}<p class="invoice-per">{data.perPaxLabel}</p>{/if}
				{#if data.estimasiNote}<p class="invoice-sum">{data.estimasiNote}</p>{/if}
			</div>
			{#if data.status === 'dp_diterima'}
				<div>
					<p class="invoice-dp-label">DP diterima</p>
					<p class="invoice-dp-figure">{data.paidLabel ?? 'Nominal menyusul'}</p>
					<p class="invoice-dp-label" style="margin-top: 0.6rem">Sisa tagihan</p>
					<p class="invoice-dp-figure">{data.remainingLabel ?? 'Menyusul'}</p>
				</div>
			{:else if data.showPayCta}
				<div>
					<p class="invoice-dp-label">{data.dpHeading}</p>
					{#if data.dpLabel}
						<p class="invoice-dp-figure">{data.dpLabel}</p>
					{:else}
						<p class="invoice-sum">Nominal DP muncul setelah estimasinya berupa angka.</p>
					{/if}
				</div>
			{:else if data.status === 'lunas' && data.paidLabel}
				<div>
					<p class="invoice-dp-label">Jumlah diterima</p>
					<p class="invoice-dp-figure">{data.paidLabel}</p>
				</div>
			{/if}
		</div>

		<p class="invoice-policy">
			{paymentPolicySummary}{' '}
			<a href={paymentPolicyPath} class="invoice-link">Kebijakan pembayaran</a>
		</p>

		{#if data.showPayCta}
			<div class="invoice-pay invoice-keep">
				<p><strong>Cara bayar sekarang</strong></p>
				<p>
					Transfer ke rekening PT: CIMB Niaga Syariah 860025788700 a/n Loox Travel Luxury. Setelah kamu transfer, kirim bukti lewat WhatsApp dan cantumkan nomor invoice {data.nomor}.
				</p>
			</div>
		{/if}

		<div class="invoice-actions no-print">
			<Button type="button" variant="primary" onclick={printInvoice}>Export PDF</Button>
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
				<Button type="button" variant="outline" disabled>{data.payLabel}</Button>
			{/if}
		</div>
		{#if data.showPayCta}
			<p class="invoice-hint no-print">
				Estimasi kamu sudah kami simpan. Pembayaran DP online segera hadir. Untuk sekarang, transfer ke rekening PT lalu kirim buktinya lewat WhatsApp.
				Untuk PDF, pilih Simpan sebagai PDF, ukuran A4, dan matikan header serta footer peramban.
			</p>
		{:else}
			<p class="invoice-hint no-print">Untuk PDF, pilih Simpan sebagai PDF, ukuran A4, dan matikan header serta footer peramban.</p>
		{/if}

		<div class="invoice-bank invoice-keep">
			<BankAccount />
		</div>
	</div>
</article>
