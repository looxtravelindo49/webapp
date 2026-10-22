<script lang="ts">
	import TestimonialForm from '#lib/components/admin/TestimonialForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Ubah ulasan | Admin Lembang Adventure</title></svelte:head>

<p class="text-xs"><a href="/admin/ulasan" class="font-bold underline">← Semua ulasan</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Ubah ulasan</h1>

{#if data.saved}
	<p role="status" class="mt-5 max-w-3xl rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">Ulasan disimpan.</p>
{/if}

<div class="mt-6 max-w-3xl">
	<TestimonialForm values={form?.values ?? data.values} errors={form?.errors} submitLabel="Simpan perubahan" />
</div>
