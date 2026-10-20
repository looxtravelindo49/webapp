<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Ganti password | Admin Lembang Adventure</title></svelte:head>

<div class="mx-auto max-w-md">
	<h1 class="text-2xl font-black tracking-tight">Ganti password</h1>
	{#if data.mustChange}
		<p class="mt-3 rounded-md border border-line bg-white px-4 py-3 text-xs leading-[1.8]">
			Akunmu masih memakai password sementara. Ganti dulu dengan password baru sebelum melanjutkan.
		</p>
	{/if}

	<form method="POST" class="mt-6 grid gap-5 rounded-xl border border-line bg-white p-6 sm:p-7">
		<Field label="Password lama" name="current" type="password" autocomplete="current-password" maxlength={1000} error={form?.errors?.current} />
		<Field
			label="Password baru"
			name="next"
			type="password"
			autocomplete="new-password"
			minlength={8}
			maxlength={128}
			hint="Minimal 8 karakter, berbeda dari password lama dan dari login."
			error={form?.errors?.next}
		/>
		<Field label="Ulangi password baru" name="confirm" type="password" autocomplete="new-password" maxlength={128} error={form?.errors?.confirm} />
		<Button type="submit" variant="accent">Simpan password baru</Button>
	</form>
</div>
