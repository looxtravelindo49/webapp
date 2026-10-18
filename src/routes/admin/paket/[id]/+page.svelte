<script lang="ts">
	import PackageForm from '#lib/components/admin/PackageForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const failed = $derived(form && 'values' in form ? form : null);
	const notice = $derived(form && 'ok' in form ? form.notice : data.created ? 'Paket dibuat sebagai draft. Terbitkan dari daftar paket setelah siap.' : '');
</script>

<svelte:head><title>Ubah {data.title} | Admin Lembang Adventures</title></svelte:head>

<p class="text-xs"><a href="/admin/paket" class="font-bold underline">← Semua paket</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Ubah paket</h1>
<p class="mt-2 text-xs text-muted">Alamat tab di situs: <code class="rounded bg-white px-1.5 py-0.5">/#paket-{data.slug}</code> (tidak berubah walau nama diganti).</p>

{#if notice}
	<p role="status" class="mt-5 max-w-3xl rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{notice}</p>
{/if}

<div class="mt-6 max-w-3xl">
	<PackageForm
		values={failed?.values ?? data.values}
		errors={failed?.errors}
		photoError={failed?.photoError}
		image={data.image}
		submitLabel="Simpan perubahan"
	/>
</div>
