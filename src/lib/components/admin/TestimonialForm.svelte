<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import TextArea from '#lib/components/admin/TextArea.svelte';
	import { TESTIMONIAL_LIMITS, type TestimonialErrors, type TestimonialRaw } from '#lib/testimonial-form.js';

	let {
		values,
		errors = {},
		submitLabel
	}: {
		values: TestimonialRaw;
		errors?: TestimonialErrors;
		submitLabel: string;
	} = $props();

	const uid = $props.id();
</script>

<form method="POST" class="grid gap-5 rounded-xl border border-line bg-white p-5 sm:p-7">
	<Field label="Nama pemberi ulasan" name="reviewer_name" value={values.name} maxlength={TESTIMONIAL_LIMITS.name} error={errors.name} autocomplete="off" hint="Salin nama yang tampil di Google. Jangan mengarang." />
	<div>
		<label for="{uid}-rating" class="mb-1.5 block text-[11px] font-bold tracking-wide">Nilai (1–5)</label>
		<select id="{uid}-rating" name="rating" value={values.rating} class="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-xs" aria-invalid={errors.rating ? true : undefined}>
			{#each [5, 4, 3, 2, 1] as n (n)}
				<option value={String(n)}>{n}</option>
			{/each}
		</select>
		{#if errors.rating}<p role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{errors.rating}</p>{/if}
	</div>
	<TextArea label="Teks ulasan" name="body" value={values.body} rows={5} maxlength={TESTIMONIAL_LIMITS.body} required error={errors.body} hint="Tempel teks asli dari Google Business Profile." />
	<div>
		<label for="{uid}-date" class="mb-1.5 block text-[11px] font-bold tracking-wide">Tanggal ulasan</label>
		<input id="{uid}-date" name="review_date" type="date" value={values.date} required class="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-xs" aria-invalid={errors.date ? true : undefined} />
		{#if errors.date}<p role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{errors.date}</p>{/if}
	</div>
	<Field label="Tautan ulasan (opsional)" name="source_url" value={values.url} required={false} maxlength={500} error={errors.url} autocomplete="off" placeholder="https://" hint="Alamat ulasan di Google, bila ada." />
	<Button type="submit" variant="accent">{submitLabel}</Button>
</form>
