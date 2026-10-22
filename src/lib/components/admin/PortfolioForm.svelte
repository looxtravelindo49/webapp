<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import TextArea from '#lib/components/admin/TextArea.svelte';
	import { optionalImage } from '#lib/images.js';
	import { PORTFOLIO_LIMITS, type PortfolioErrors, type PortfolioRaw } from '#lib/portfolio-form.js';

	const MAX_BYTES = 4 * 1024 * 1024;
	const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

	let {
		values,
		errors = {},
		photoError = '',
		image = null,
		submitLabel
	}: {
		values: PortfolioRaw;
		errors?: PortfolioErrors;
		photoError?: string;
		image?: string | null;
		submitLabel: string;
	} = $props();

	const uid = $props.id();
	let clientPhotoError = $state('');
	const shownPhotoError = $derived(clientPhotoError || photoError);
	const preview = $derived(optionalImage(image));

	function checkFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		clientPhotoError = '';
		if (!file) return;
		if (!ACCEPT.includes(file.type)) clientPhotoError = 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.';
		else if (file.size > MAX_BYTES) clientPhotoError = 'Foto terlalu besar. Maksimal 4 MB.';
		if (clientPhotoError) e.currentTarget.value = '';
	}
</script>

<form method="POST" enctype="multipart/form-data" class="grid gap-5 rounded-xl border border-line bg-white p-5 sm:p-7">
	<Field label="Judul" name="title" value={values.title} maxlength={PORTFOLIO_LIMITS.title} error={errors.title} autocomplete="off" />
	<Field label="Lokasi" name="location" value={values.location} maxlength={PORTFOLIO_LIMITS.location} error={errors.location} autocomplete="off" />
	<div class="grid gap-5 sm:grid-cols-2">
		<Field label="Tanggal" name="event_date" value={values.eventDate} maxlength={PORTFOLIO_LIMITS.eventDate} error={errors.eventDate} autocomplete="off" placeholder="30 Jul-1 Agu 2026" />
		<Field label="Jenis kegiatan" name="event_type" value={values.eventType} maxlength={PORTFOLIO_LIMITS.eventType} error={errors.eventType} autocomplete="off" placeholder="Gathering" />
	</div>
	<TextArea label="Keterangan singkat" name="caption" value={values.caption} rows={3} maxlength={PORTFOLIO_LIMITS.caption} required error={errors.caption} />
	<Field label="Teks alternatif foto" name="alt" value={values.alt} required={false} maxlength={PORTFOLIO_LIMITS.alt} error={errors.alt} autocomplete="off" hint="Wajib bila ada foto. Jelaskan isi foto untuk pembaca layar." />

	<div>
		<label for="{uid}-photo" class="mb-1.5 block text-[11px] font-bold tracking-wide">Foto</label>
		{#if preview}
			<img src={preview} alt="" class="mb-3 aspect-[4/3] max-w-xs rounded-lg object-cover" />
		{:else}
			<p class="mb-3 text-[11px] text-muted">Belum ada foto. Di situs tertulis "Foto segera".</p>
		{/if}
		<input id="{uid}-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" class="block w-full text-xs" aria-invalid={shownPhotoError ? true : undefined} aria-describedby={shownPhotoError ? `${uid}-photo-error` : `${uid}-photo-hint`} onchange={checkFile} />
		<p id="{uid}-photo-hint" class="mt-1.5 text-[11px] leading-relaxed text-muted">JPEG, PNG, WebP, atau AVIF, maksimal 4 MB. Disimpan sebagai WebP, sisi terpanjang 1600 piksel, di bawah 300 KB.</p>
		{#if shownPhotoError}<p id="{uid}-photo-error" role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{shownPhotoError}</p>{/if}
		{#if preview}
			<label class="mt-3 flex items-center gap-2 text-xs">
				<input type="checkbox" name="remove_photo" value="yes" checked={values.removePhoto} />
				Hapus foto (kembali ke "Foto segera")
			</label>
		{/if}
	</div>

	<Button type="submit" variant="accent">{submitLabel}</Button>
</form>
