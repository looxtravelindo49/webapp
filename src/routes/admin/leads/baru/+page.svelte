<script lang="ts">
	import InvoiceEditor from '#lib/components/admin/InvoiceEditor.svelte';
	import { EMPTY_INVOICE_SEED, seedFromFailedForm } from '#lib/invoice-form.js';
	import { DP_PERCENT } from '#lib/invoice.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const failed = $derived(form && 'message' in form ? form : null);
	const seed = $derived(failed && 'deskripsi' in failed ? seedFromFailedForm(failed) : EMPTY_INVOICE_SEED);
</script>

<svelte:head><title>Buat Invoice Manual | Leads</title></svelte:head>

<p class="text-[11px] font-bold"><a href="/admin/leads" class="underline">Kembali ke Leads</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Buat Invoice Manual</h1>
<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
	Invoice ini masuk ke daftar Leads dengan nomor yang sama seperti kalkulator. Total, Fee Services, dan DP dihitung di server. DP bawaan {DP_PERCENT}% bisa diganti persen atau nominal.
</p>

<InvoiceEditor packages={data.packages} {seed} message={failed && 'message' in failed ? failed.message : ''} />
