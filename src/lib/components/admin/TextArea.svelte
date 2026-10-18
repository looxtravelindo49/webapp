<script lang="ts">
	let {
		label,
		name,
		value = '',
		error = '',
		hint = '',
		required = false,
		rows = 3,
		maxlength,
		placeholder
	}: {
		label: string;
		name: string;
		/** Nilai awal; dirender sebagai ISI elemen (bukan properti `value`) agar hidrasi tidak menimpa ketikan. */
		value?: string;
		error?: string;
		hint?: string;
		required?: boolean;
		rows?: number;
		maxlength?: number;
		placeholder?: string;
	} = $props();

	const uid = $props.id();
	const errId = $derived(`${uid}-error`);
	const hintId = $derived(`${uid}-hint`);
	const describedBy = $derived([error ? errId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined);
</script>

<div>
	<label for="{uid}-input" class="mb-1.5 block text-[11px] font-bold tracking-wide">{label}</label>
	<textarea
		id="{uid}-input"
		{name}
		{rows}
		{required}
		{maxlength}
		{placeholder}
		aria-invalid={error ? true : undefined}
		aria-describedby={describedBy}
		class="w-full resize-y rounded-md border bg-white px-3 py-2.5 text-xs leading-[1.7] text-green-900 {error ? 'border-danger' : 'border-line'}">{value}</textarea
	>
	{#if hint}<p id={hintId} class="mt-1.5 text-[11px] text-muted">{hint}</p>{/if}
	{#if error}<p id={errId} role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{error}</p>{/if}
</div>
