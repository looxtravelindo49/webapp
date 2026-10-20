<script lang="ts">
	import { FLOAT_WA_NUMBER, floatWaMessage, waLink } from '#lib/whatsapp.js';

	let { packageTitle = null }: { packageTitle?: string | null } = $props();

	const href = $derived(waLink(FLOAT_WA_NUMBER, floatWaMessage(packageTitle)));
</script>

<a
	{href}
	target="_blank"
	rel="noopener noreferrer"
	aria-label="Chat kami di WhatsApp"
	class="print-hide print:hidden fixed z-30 flex items-center gap-2 rounded-full bg-[#25D366] p-3 text-white shadow-[0_8px_24px_rgb(8_28_24/0.28)] right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] hover:bg-[#1daf54] md:right-[max(1rem,env(safe-area-inset-right))] md:bottom-[max(1rem,env(safe-area-inset-bottom))] md:px-4 md:py-3"
>
	<svg class="size-6 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
		<path
			fill="currentColor"
			d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l6-1.6A11 11 0 0 0 12 23a11 11 0 0 0 8.5-19.5ZM12 21a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.9.9-3.4-.2-.3A9 9 0 1 1 12 21Zm5.1-6.7c-.3-.1-1.6-.8-1.8-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.2.2-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.1 8.1 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.4.2-.4a.5.5 0 0 0 0-.4c0-.1-.6-1.5-.8-2s-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4.1c.6.2 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.6-.6 1.8-1.3.2-.6.2-1.2.1-1.3-.1-.2-.3-.2-.6-.3Z"
		/>
	</svg>
	<span class="hidden text-xs font-bold md:inline">Chat kami</span>
</a>
