<script lang="ts">
	import PortfolioForm from '#lib/components/admin/PortfolioForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const failed = $derived(form && 'values' in form ? form : null);
	const notice = $derived(data.saved ? 'Dokumentasi disimpan.' : '');
</script>

<svelte:head><title>Ubah {data.item.title} | Admin Lembang Adventure</title></svelte:head>

<p class="text-xs"><a href="/admin/portfolio" class="font-bold underline">← Semua portfolio</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Ubah dokumentasi</h1>

{#if notice}
	<p role="status" class="mt-5 max-w-3xl rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{notice}</p>
{/if}

<div class="mt-6 max-w-3xl">
	<PortfolioForm
		values={failed?.values ?? data.values}
		errors={failed?.errors}
		photoError={failed?.photoError}
		image={data.item.image}
		submitLabel="Simpan perubahan"
	/>
</div>
