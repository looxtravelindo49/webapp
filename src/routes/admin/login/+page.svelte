<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>Masuk | Admin Lembang Adventures</title></svelte:head>

<div class="mx-auto max-w-sm pt-6 sm:pt-14">
	<div class="mb-6 text-center">
		<div class="text-[26px] font-black tracking-[-0.05em]">Lembang <span class="font-medium">Adventures</span></div>
		<div class="eyebrow mt-2 text-muted">AREA ADMIN</div>
	</div>

	<form method="POST" class="grid gap-5 rounded-xl border border-line bg-white p-6 sm:p-7">
		<h1 class="text-xl font-black tracking-tight">Masuk</h1>
		{#if form?.error}
			<p role="alert" class="rounded-md border border-danger bg-white px-3 py-2.5 text-xs font-semibold text-danger">
				{form.error}
			</p>
		{/if}
		<Field label="Login" name="login" value={form?.login ?? ''} autocomplete="username" maxlength={200} />
		<Field label="Password" name="password" type="password" autocomplete="current-password" maxlength={1000} />
		<Button type="submit" variant="accent" class="w-full">Masuk</Button>
	</form>
</div>
