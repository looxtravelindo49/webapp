<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { formatRupiah } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const lead = $derived(data.lead);
	const noteFailed = $derived(form && 'error' in form ? form : null);
	const statusFailed = $derived(form && 'statusError' in form && form.statusError ? form : null);
	const dateValue = $derived(
		statusFailed && 'diterima_pada' in statusFailed ? statusFailed.diterima_pada : (lead.diterima_pada ?? '')
	);
	const amountValue = $derived(
		statusFailed && 'jumlah_diterima' in statusFailed ? statusFailed.jumlah_diterima : lead.jumlahInput
	);
</script>

<svelte:head><title>{lead.nomor_invoice} | Leads</title></svelte:head>

<p class="text-[11px] font-bold"><a href="/admin/leads" class="underline">Kembali ke Leads</a></p>
<div class="mt-3 flex flex-wrap items-start justify-between gap-3">
	<div>
		<h1 class="text-2xl font-black tracking-tight">{lead.nomor_invoice}</h1>
		<p class="mt-1 text-xs text-muted">{lead.createdLabel}</p>
		<p class="mt-2 inline-block rounded-full bg-cream px-2.5 py-1 text-[10px] font-bold">{lead.badge}</p>
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
	<div>
		<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Tanggal diterima</dt>
		<dd>{lead.diterimaLabel ?? 'Belum dicatat'}</dd>
	</div>
	<div>
		<dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Jumlah diterima</dt>
		<dd>{lead.jumlahLabel ?? 'Belum dicatat'}</dd>
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
	<div class="sm:col-span-2"><dt class="text-[10px] font-bold tracking-wide text-muted uppercase">Tautan invoice</dt><dd class="break-all">{lead.invoice_url}</dd></div>
</dl>

<form
	method="POST"
	action="?/status"
	class="mt-5 grid max-w-xl gap-3 rounded-xl border border-line bg-white p-5"
	onsubmit={(e) => {
		const submitter = e.submitter;
		if (!(submitter instanceof HTMLButtonElement) || submitter.value !== 'batal') return;
		if (!confirm('Batalkan invoice ini? Statusnya jadi Batal.')) {
			e.preventDefault();
			return;
		}
		const flag = e.currentTarget.elements.namedItem('confirm');
		if (flag instanceof HTMLInputElement) flag.value = 'yes';
	}}
>
	<p class="text-[10px] font-bold tracking-wide uppercase">Konfirmasi bayar</p>
	<p class="text-[11px] leading-[1.7] text-muted">
		Xendit belum disambung. Catat DP atau pelunasan di sini setelah transfer masuk. Kosongkan tanggal untuk memakai hari ini. Jumlah boleh dikosongkan.
	</p>
	<label class="grid gap-1 text-[11px] font-semibold" for="diterima_pada">
		Tanggal diterima
		<input id="diterima_pada" name="diterima_pada" type="date" value={dateValue} class="w-full rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
	</label>
	<label class="grid gap-1 text-[11px] font-semibold" for="jumlah_diterima">
		Jumlah diterima (opsional)
		<input
			id="jumlah_diterima"
			name="jumlah_diterima"
			inputmode="numeric"
			autocomplete="off"
			maxlength="20"
			value={amountValue}
			placeholder="mis. 1500000"
			class="w-full rounded-md border border-line px-3 py-2.5 text-xs font-normal"
		/>
	</label>
	<input type="hidden" name="confirm" value="" />
	{#if statusFailed}<p role="alert" class="text-[11px] font-semibold text-danger">{statusFailed.statusError}</p>{/if}
	{#if form && 'kind' in form && form.kind === 'status'}
		<p role="status" class="text-[11px] font-semibold">{form.notice}</p>
	{/if}
	<div class="flex flex-wrap gap-2">
		<Button type="submit" name="status" value="dp_diterima" variant="primary">Konfirmasi DP diterima</Button>
		<Button type="submit" name="status" value="lunas" variant="outline">Tandai lunas</Button>
		<Button type="submit" name="status" value="batal" variant="danger">Batalkan</Button>
	</div>
</form>

<form method="POST" action="?/catatan" class="mt-5 grid max-w-xl gap-3 rounded-xl border border-line bg-white p-5">
	<label for="catatan_admin" class="text-[10px] font-bold tracking-wide uppercase">Catatan internal</label>
	<textarea
		id="catatan_admin"
		name="catatan_admin"
		maxlength="500"
		rows="3"
		class="w-full rounded-md border border-line px-3 py-2.5 text-xs"
	>{noteFailed && 'catatan' in noteFailed ? noteFailed.catatan : (lead.catatan_admin ?? '')}</textarea>
	{#if noteFailed}<p role="alert" class="text-[11px] font-semibold text-danger">{noteFailed.error}</p>{/if}
	{#if form && 'kind' in form && form.kind === 'catatan'}
		<p role="status" class="text-[11px] font-semibold">{form.notice}</p>
	{/if}
	<div><Button type="submit" variant="outline">Simpan catatan</Button></div>
</form>
