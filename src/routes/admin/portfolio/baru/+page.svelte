<script lang="ts">
	import PortfolioForm from '#lib/components/admin/PortfolioForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Tambah dokumentasi | Admin Lembang Adventure</title></svelte:head>

<p class="text-xs"><a href="/admin/portfolio" class="font-bold underline">← Semua portfolio</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Tambah dokumentasi</h1>
<p class="mt-2 max-w-2xl text-xs leading-relaxed text-muted">Foto boleh dikosongkan. Situs akan menampilkan "Foto segera" sampai kamu mengunggah foto.</p>

<div class="mt-6 max-w-3xl">
	<PortfolioForm values={form?.values ?? data.values} errors={form?.errors} photoError={form?.photoError} submitLabel="Simpan" />
</div>
