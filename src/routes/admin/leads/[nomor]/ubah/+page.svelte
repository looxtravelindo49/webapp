<script lang="ts">
	import InvoiceEditor from '#lib/components/admin/InvoiceEditor.svelte';
	import { seedFromFailedForm } from '#lib/invoice-form.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const failed = $derived(form && 'message' in form ? form : null);
	const seed = $derived(failed && 'deskripsi' in failed ? seedFromFailedForm(failed) : data.seed);
</script>

<svelte:head><title>Edit {data.nomor} | Leads</title></svelte:head>

<p class="text-[11px] font-bold"><a href="/admin/leads/{data.nomor}" class="underline">Kembali ke invoice</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Edit {data.nomor}</h1>
<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
	Perubahan harga, baris, Include, Fee Services, dan DP disimpan ke invoice yang sama. Nomor, tautan, dan status bayar tidak berubah. Halaman publik langsung memakai data baru.
</p>

<InvoiceEditor packages={data.packages} {seed} message={failed && 'message' in failed ? failed.message : ''} submitLabel="Simpan perubahan" />
