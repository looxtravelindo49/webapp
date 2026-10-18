<script lang="ts">
	import ArticleForm from '#lib/components/admin/ArticleForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const failed = $derived(form && 'values' in form ? form : null);
	const notice = $derived(form && 'ok' in form ? form.notice : data.created ? 'Artikel dibuat sebagai draf. Centang "Tampilkan di situs" lalu simpan, atau terbitkan dari daftar artikel, setelah siap.' : '');
</script>

<svelte:head><title>Ubah {data.title} | Admin Lembang Adventures</title></svelte:head>

<p class="text-xs"><a href="/admin/artikel" class="font-bold underline">← Semua artikel</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Ubah artikel</h1>
<p class="mt-2 text-xs text-muted">
	Alamat di situs: <code class="rounded bg-white px-1.5 py-0.5">/artikel/{data.slug}</code> (tidak berubah walau judul diganti).
	{#if data.published}<a href="/artikel/{data.slug}" target="_blank" rel="noopener" class="font-bold underline">Lihat di situs ↗</a>{/if}
</p>

{#if notice}
	<p role="status" class="mt-5 max-w-3xl rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{notice}</p>
{/if}

<div class="mt-6 max-w-3xl">
	<ArticleForm
		values={failed?.values ?? data.values}
		errors={failed?.errors}
		photoError={failed?.photoError}
		cover={data.cover}
		credit={data.credit}
		unsplashEnabled={data.unsplashEnabled}
		submitLabel="Simpan perubahan"
	/>
</div>
