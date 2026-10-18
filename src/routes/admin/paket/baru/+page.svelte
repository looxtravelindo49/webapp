<script lang="ts">
	import PackageForm from '#lib/components/admin/PackageForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Tambah paket | Admin Lembang Adventures</title></svelte:head>

<p class="text-xs"><a href="/admin/paket" class="font-bold underline">← Semua paket</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Tambah paket</h1>

<div class="mt-6 max-w-3xl">
	<PackageForm values={form?.values ?? data.values} errors={form?.errors} photoError={form?.photoError} submitLabel="Simpan sebagai draft" isNew />
</div>
