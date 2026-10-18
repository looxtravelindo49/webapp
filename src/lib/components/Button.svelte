<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'accent' | 'outline' | 'danger' | 'link';
	type Props = {
		variant?: Variant;
		href?: string;
		class?: string;
		children: Snippet;
	} & Omit<HTMLAnchorAttributes & HTMLButtonAttributes, 'class' | 'children'>;

	let { variant = 'primary', href, class: extra = '', children, ...rest }: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-3 text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';
	const variants: Record<Variant, string> = {
		primary: 'rounded-lg bg-green-900 px-5 py-3.25 text-white hover:bg-green-800',
		accent: 'rounded-lg bg-accent px-5 py-3.25 text-green-900 hover:bg-accent-hover',
		outline: 'rounded-lg border border-line bg-white px-5 py-3.25 text-green-900 hover:bg-cream',
		danger: 'rounded-lg bg-danger px-5 py-3.25 text-white hover:bg-danger-hover',
		link: 'border-b border-current py-1.25 hover:opacity-80'
	};
	const classes = $derived(`${base} ${variants[variant]} ${extra}`);
</script>

{#if href}
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>{@render children()}</a>
{:else}
	<button type="button" class={classes} {...rest as HTMLButtonAttributes}>{@render children()}</button>
{/if}
