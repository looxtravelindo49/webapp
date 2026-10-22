<script lang="ts">
	import TestimonialForm from '#lib/components/admin/TestimonialForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Tambah ulasan | Admin Lembang Adventure</title></svelte:head>

<p class="text-xs"><a href="/admin/ulasan" class="font-bold underline">← Semua ulasan</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Tambah ulasan</h1>
<p class="mt-2 max-w-2xl text-xs leading-relaxed text-muted">Salin satu ulasan dari Google. Kosongkan tautan bila kamu tidak punya alamat ulasan tersebut.</p>

<div class="mt-6 max-w-3xl">
	<TestimonialForm values={form?.values ?? data.values} errors={form?.errors} submitLabel="Simpan" />
</div>
