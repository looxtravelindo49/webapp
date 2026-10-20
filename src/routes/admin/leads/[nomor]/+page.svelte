<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { formatRupiah } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const lead = $derived(data.lead);
	const failed = $derived(form && 'error' in form ? form : null);
</script>

<svelte:head><title>{lead.nomor_invoice} | Leads</title></svelte:head>

<p class="text-[11px] font-bold"><a href="/admin/leads" class="underline">Kembali ke Leads</a></p>
<div class="mt-3 flex flex-wrap items-start justify-between gap-3">
	<div>
		<h1 class="text-2xl font-black tracking-tight">{lead.nomor_invoice}</h1>
		<p class="mt-1 text-xs text-muted">{lead.createdLabel} · {lead.statusLabel}</p>
	</div>
	<Button href="/invoice/{lead.nomor_invoice}" variant="accent" target="_blank" rel="noopener">Buka invoice ↗</Button>
</div>

<dl class="mt-6 grid gap-4 rounded-xl border border-line bg-white p-5 text-xs sm:grid-cols-2 sm:p-6">
	<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Nama</dt><dd class="font-semibold">{lead.nama}</dd></div>
	<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">WhatsApp</dt><dd class="font-semibold">+{lead.whatsapp}</dd></div>
	<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Peserta</dt><dd>{lead.jumlah_peserta.toLocaleString('id-ID')} orang</dd></div>
	<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Tanggal acara</dt><dd>{lead.tanggalLabel}</dd></div>
	<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Total estimasi</dt><dd class="font-semibold">{lead.estimasiLabel}</dd></div>
	<div>
		<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">DP {lead.dpPercent}%</dt>
		<dd>{lead.dpLabel ?? 'Menyusul (estimasi belum berupa angka)'}</dd>
	</div>
	<div class="sm:col-span-2">
		<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Paket</dt>
		<dd class="mt-1">
			{#if lead.lines.length === 0}
				—
			{:else}
				<ul class="divide-y divide-line">
					{#each lead.lines as line (line.slug + line.title)}
						<li class="flex justify-between gap-3 py-1.5">
							<span>{line.title}</span>
							<span class="font-semibold">{line.subtotal === null ? 'Harga menyusul' : formatRupiah(line.subtotal)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</dd>
	</div>
	<div class="sm:col-span-2">
		<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Catatan pengunjung</dt>
		<dd class="whitespace-pre-wrap">{lead.catatan || '—'}</dd>
	</div>
	<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Xendit</dt><dd>{lead.xendit_invoice_id ? `${lead.xendit_status ?? 'terhubung'} · ${lead.xendit_invoice_id}` : 'Belum dihubungkan'}</dd></div>
	<div><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Dibayar</dt><dd>{lead.paid_at ? lead.paid_at : 'Belum'}</dd></div>
	<div class="sm:col-span-2"><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Tautan invoice</dt><dd class="break-all">{lead.invoice_url}</dd></div>
</dl>

<form method="POST" action="?/catatan" class="mt-5 grid max-w-xl gap-3 rounded-xl border border-line bg-white p-5">
	<label for="catatan_admin" class="text-[10px] font-bold tracking-wide uppercase">Catatan admin</label>
	<textarea
		id="catatan_admin"
		name="catatan_admin"
		maxlength="2000"
		rows="4"
		class="w-full rounded-md border border-line px-3 py-2.5 text-xs"
	>{failed && 'catatan' in failed ? failed.catatan : (lead.catatan_admin ?? '')}</textarea>
	{#if failed}<p role="alert" class="text-[11px] font-semibold text-danger">{failed.error}</p>{/if}
	{#if form && 'ok' in form && form.ok}
		<p role="status" class="text-[11px] font-semibold">{form.notice}</p>
	{/if}
	<div><Button type="submit" variant="outline">Simpan catatan</Button></div>
</form>
