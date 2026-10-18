<script lang="ts">
	let {
		label,
		name,
		type = 'text',
		value = '',
		error = '',
		hint = '',
		autocomplete,
		required = true,
		minlength,
		maxlength,
		disabled = false,
		inputmode,
		placeholder
	}: {
		label: string;
		name: string;
		type?: 'text' | 'password';
		/** Nilai awal (tidak pernah diisi untuk password). */
		value?: string;
		error?: string;
		hint?: string;
		autocomplete?: 'username' | 'current-password' | 'new-password' | 'off';
		required?: boolean;
		minlength?: number;
		maxlength?: number;
		disabled?: boolean;
		inputmode?: 'numeric' | 'text' | 'tel';
		placeholder?: string;
	} = $props();

	const uid = $props.id();
	const errId = $derived(`${uid}-error`);
	const hintId = $derived(`${uid}-hint`);
	// Properti `value` hanya dipasang bila ada isinya. Jika selalu dipasang (walau kosong), hidrasi
	// menimpa isian yang sudah diketik pengguna sebelum JavaScript selesai dimuat.
	const valueAttrs = $derived(type !== 'password' && value ? { value } : {});
	const describedBy = $derived([error ? errId : '', hint ? hintId : ''].filter(Boolean).join(' ') || undefined);
</script>

<div>
	<label for="{uid}-input" class="mb-1.5 block text-[11px] font-bold tracking-wide">{label}</label>
	<input
		id="{uid}-input"
		{name}
		{type}
		{...valueAttrs}
		{autocomplete}
		{required}
		{minlength}
		{maxlength}
		{disabled}
		{inputmode}
		{placeholder}
		aria-invalid={error ? true : undefined}
		aria-describedby={describedBy}
		class="w-full rounded-md border bg-white px-3 py-2.5 text-xs text-green-900 disabled:opacity-60 {error ? 'border-danger' : 'border-line'}"
	/>
	{#if hint}<p id={hintId} class="mt-1.5 text-[11px] text-muted">{hint}</p>{/if}
	{#if error}<p id={errId} role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{error}</p>{/if}
</div>
