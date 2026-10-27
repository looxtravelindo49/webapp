<script lang="ts">
	import { onMount } from 'svelte';
	import { formatSisaWaktu, validityRemaining } from '#lib/invoice-validity.js';

	let {
		expiresAt,
		untilLabel,
		contactUrl,
		serverNow
	}: {
		expiresAt: string;
		untilLabel: string;
		contactUrl: string;
		serverNow: number;
	} = $props();

	// Tetap `null` sampai mount supaya HTML server dan hidrasi memakai `serverNow` yang sama.
	let nowMs = $state<number | null>(null);

	onMount(() => {
		const update = () => {
			nowMs = Date.now();
		};
		update();
		const timer = window.setInterval(update, 1000);
		return () => window.clearInterval(timer);
	});

	const left = $derived(validityRemaining(expiresAt, new Date(nowMs ?? serverNow)));
</script>

<p class="invoice-valid-until">Berlaku hingga {untilLabel}</p>
{#if left.expired}
	<div class="invoice-expired no-print" role="status">
		<p>Invoice kedaluwarsa, hubungi kami via <a href={contactUrl}>WhatsApp</a></p>
	</div>
{:else}
	<div class="invoice-countdown no-print">
		<p>Berlaku hingga {untilLabel} / sisa waktu {formatSisaWaktu(left)}</p>
	</div>
{/if}
