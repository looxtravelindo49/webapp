<script lang="ts">
	import ArticleForm from '#lib/components/admin/ArticleForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Tambah artikel | Admin Lembang Adventure</title></svelte:head>

<p class="text-xs"><a href="/admin/artikel" class="font-bold underline">← Semua artikel</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Tambah artikel</h1>

<div class="mt-6 max-w-3xl">
	<ArticleForm values={form?.values ?? data.values} errors={form?.errors} photoError={form?.photoError} unsplashEnabled={data.unsplashEnabled} submitLabel="Simpan sebagai draf" isNew />
</div>
