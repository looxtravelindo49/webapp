<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const failed = $derived(form && 'error' in form ? form : null);
</script>

<svelte:head><title>Pengaturan | Admin Lembang Adventure</title></svelte:head>

<h1 class="text-2xl font-black tracking-tight">Pengaturan</h1>
<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">Perubahan langsung dipakai di situs publik tanpa perlu build ulang.</p>

{#if form && 'ok' in form && form.ok}
	<p role="status" class="mt-5 max-w-lg rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{form.notice}</p>
{/if}

<section class="mt-6" aria-labelledby="wa">
	<h2 id="wa" class="mb-3 text-sm font-extrabold tracking-wide uppercase">WhatsApp</h2>
	<form method="POST" class="grid max-w-lg gap-5 rounded-xl border border-line bg-white p-6 sm:p-7">
		<Field
			label="Nomor WhatsApp tujuan"
			name="whatsapp"
			value={failed ? failed.whatsapp : data.whatsapp}
			required={false}
			inputmode="tel"
			autocomplete="off"
			placeholder="0812-3456-7890"
			hint="Boleh format lokal (0812-…) atau internasional (+62 812 …); disimpan sebagai 62812…. Kosongkan untuk menyembunyikan tombol WhatsApp di kalkulator."
			error={failed?.error}
		/>
		<Button type="submit" variant="accent">Simpan</Button>
	</form>
</section>
