<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		restoreFocus = $bindable(true),
		title,
		label = '',
		children
	}: {
		open?: boolean;
		/** false = jangan kembalikan fokus ke pemicu saat ditutup (mis. saat menavigasi ke anchor). */
		restoreFocus?: boolean;
		title: string;
		label?: string;
		children: Snippet;
	} = $props();

	const uid = $props.id();
	let el: HTMLDialogElement;
	let returnTo: HTMLElement | null = null;

	$effect(() => {
		if (open && !el.open) {
			returnTo = document.activeElement as HTMLElement | null;
			el.showModal();
		} else if (!open && el.open) {
			el.close();
		}
	});

	function onclose() {
		open = false;
		if (restoreFocus) returnTo?.focus();
		returnTo = null;
		restoreFocus = true;
	}

	// Pembungkus dalam mengisi seluruh dialog, jadi klik langsung pada <dialog> = klik backdrop.
	function onclick(e: MouseEvent) {
		if (e.target === el) el.close();
	}
</script>

<dialog
	bind:this={el}
	{onclose}
	{onclick}
	aria-labelledby="{uid}-title"
	class="m-auto max-h-[90vh] w-[min(570px,calc(100%-32px))] rounded-2xl border border-line bg-white p-0 text-green-900 shadow-2xl"
>
	<div class="flex items-start justify-between gap-4 px-5.5 pt-5.5 sm:px-7 sm:pt-6">
		<div>
			{#if label}<div class="eyebrow text-muted">{label}</div>{/if}
			<h2 id="{uid}-title" class="my-1 text-[23px] leading-tight font-black tracking-tight sm:text-[25px]">
				{title}
			</h2>
		</div>
		<button
			type="button"
			onclick={() => el.close()}
			aria-label="Tutup dialog"
			class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-white text-lg hover:bg-cream"
			>×</button
		>
	</div>
	<div class="px-5.5 pt-4 pb-6 sm:px-7 sm:pb-7">
		{#if open}{@render children()}{/if}
	</div>
</dialog>
