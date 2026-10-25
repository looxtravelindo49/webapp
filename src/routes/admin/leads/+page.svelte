<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { formatRupiah } from '#lib/format.js';
	import { formatDateTime } from '#lib/format.js';
	import { formatPlanDate } from '#lib/estimate.js';
	import { LEAD_STATUSES, parseStoredLines, paymentBadge, statusLabel } from '#lib/invoice.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = (typeof data.leads)[number];
	const titles = (lead: Row) => parseStoredLines(lead.paket).map((l) => l.title).join(', ') || '—';
	const total = (lead: Row) => (lead.estimasi_total === null ? 'Dibahas via WhatsApp' : formatRupiah(lead.estimasi_total));
	const when = (lead: Row) => (lead.tanggal_acara ? formatPlanDate(lead.tanggal_acara) : 'Belum ditentukan');
	const received = (lead: Row) => (lead.jumlah_diterima === null ? null : formatRupiah(lead.jumlah_diterima));

	const filters = $derived([
		{ href: '/admin/leads', label: 'Semua', current: data.status === null },
		...LEAD_STATUSES.map((status) => ({
			href: `/admin/leads?status=${status}`,
			label: statusLabel(status),
			current: data.status === status
		}))
	]);
</script>

<svelte:head><title>Leads | Admin Lembang Adventure</title></svelte:head>

<div class="flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-black tracking-tight">Leads</h1>
	<Button href="/admin/leads/baru" variant="primary">Buat Invoice Manual</Button>
</div>
<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
	Setiap ketukan "Booking via WhatsApp" di kalkulator beranda masuk ke sini, lengkap dengan nomor invoice.
</p>

<nav class="mt-4 flex flex-wrap gap-2" aria-label="Saring status">
	{#each filters as filter (filter.href)}
		<a
			href={filter.href}
			aria-current={filter.current ? 'page' : undefined}
			class="rounded-full border border-line px-3 py-1 text-[11px] font-bold {filter.current
				? 'bg-green-900 text-white'
				: 'bg-white text-green-900'}"
		>{filter.label}</a>
	{/each}
</nav>

{#if data.leads.length === 0}
	<p class="mt-6 rounded-xl border border-line bg-white p-6 text-xs text-muted">
		{data.status ? 'Tidak ada lead dengan status ini.' : 'Belum ada lead. Daftar ini terisi setelah pengunjung menekan Booking via WhatsApp.'}
	</p>
{:else}
	{#if data.total > data.leads.length}
		<p class="mt-5 text-[11px] text-muted">Menampilkan {data.leads.length} lead terbaru dari {data.total}.</p>
	{/if}
	<ul class="mt-5 grid gap-3">
		{#each data.leads as lead (lead.id)}
			<li class="rounded-xl border border-line bg-white p-4 sm:p-5">
				<div class="flex flex-wrap items-start justify-between gap-2">
					<div>
						<p class="text-[11px] text-muted">{formatDateTime(lead.created_at)}</p>
						<a href="/admin/leads/{lead.nomor_invoice}" class="text-sm font-black tracking-tight hover:underline">{lead.nomor_invoice}</a>
					</div>
					<span class="rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold">{paymentBadge(lead.status, lead.diterima_pada)}</span>
				</div>
				<dl class="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
					<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Status</dt><dd class="font-semibold">{statusLabel(lead.status)}</dd></div>
					<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Nama</dt><dd class="font-semibold">{lead.nama}</dd></div>
					<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">WhatsApp</dt><dd class="font-semibold">+{lead.whatsapp}</dd></div>
					<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Paket</dt><dd>{titles(lead)}</dd></div>
					<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Peserta</dt><dd>{lead.jumlah_peserta.toLocaleString('id-ID')} orang</dd></div>
					<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Tanggal</dt><dd>{when(lead)}</dd></div>
					<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Total</dt><dd class="font-semibold">{total(lead)}</dd></div>
					{#if received(lead)}
						<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Diterima</dt><dd class="font-semibold">{received(lead)}</dd></div>
					{/if}
					{#if lead.catatan}
						<div class="sm:col-span-2">
							<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Catatan</dt>
							<dd class="line-clamp-2 whitespace-pre-wrap">{lead.catatan}</dd>
						</div>
					{/if}
				</dl>
				<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold">
					<a href="/admin/leads/{lead.nomor_invoice}" class="underline">Detail</a>
					<a href="/invoice/{lead.nomor_invoice}" class="underline" target="_blank" rel="noopener">Invoice ↗</a>
				</div>
			</li>
		{/each}
	</ul>
{/if}
