<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { PORTFOLIO_LIMITS } from '#lib/portfolio-form.js';

	const uid = $props.id();
	let rows = $state<{ name: string; alt: string; caption: string }[]>([]);

	function onFiles(e: Event & { currentTarget: HTMLInputElement }) {
		const files = [...(e.currentTarget.files ?? [])];
		rows = files.map((file) => ({ name: file.name, alt: '', caption: '' }));
	}
</script>

<form method="POST" action="?/unggah" enctype="multipart/form-data" class="grid gap-4 rounded-xl border border-line bg-white p-5 sm:p-7">
	<div>
		<label for="{uid}-photo" class="mb-1.5 block text-[11px] font-bold tracking-wide">Foto</label>
		<input id="{uid}-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple required class="block w-full text-xs" onchange={onFiles} />
		<p class="mt-1.5 text-[11px] leading-relaxed text-muted">Satu atau beberapa foto sekaligus. JPEG, PNG, WebP, atau AVIF. Disimpan sebagai WebP, sisi terpanjang 1600 piksel, di bawah 300 KB. Paling banyak 4 MB per unggahan.</p>
	</div>
	{#each rows as row, i (row.name + i)}
		<fieldset class="grid gap-3 rounded-lg border border-line p-4">
			<legend class="px-1 text-[11px] font-bold">Foto {i + 1}: {row.name}</legend>
			<label class="grid gap-1 text-[11px] font-bold">
				Teks alternatif
				<input name="alt" required maxlength={PORTFOLIO_LIMITS.alt} bind:value={row.alt} class="rounded-lg border border-line px-3 py-2 text-xs font-normal" />
			</label>
			<label class="grid gap-1 text-[11px] font-bold">
				Keterangan singkat (opsional)
				<input name="caption" maxlength={PORTFOLIO_LIMITS.caption} bind:value={row.caption} class="rounded-lg border border-line px-3 py-2 text-xs font-normal" />
			</label>
		</fieldset>
	{/each}
	<Button type="submit" variant="accent">Unggah</Button>
</form>
