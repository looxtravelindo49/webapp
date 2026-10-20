<script lang="ts">
	import { navLinks, site } from '#lib/content/site.js';
	import Button from './Button.svelte';

	let open = $state(false);
	const menuId = $props.id();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<header class="print-hide sticky top-0 z-10 border-b border-line bg-white/98">
	<div class="wrap flex h-17.5 items-center justify-between gap-4 sm:h-21 sm:gap-7">
		<a href="/" class="leading-none whitespace-nowrap" aria-label="{site.name} beranda">
			<span class="block text-[22px] font-black tracking-[-0.06em] sm:text-[26px]"
				>Lembang <span class="font-medium">Adventure</span></span
			>
			<small class="mt-2 block text-[8px] font-bold tracking-[0.18em] uppercase">{site.byline}</small>
		</a>

		<nav
			id="{menuId}-nav"
			aria-label="Navigasi utama"
			class="text-xs font-semibold {open
				? 'absolute inset-x-0 top-17.5 sm:top-21 flex flex-col items-start gap-5 border-b border-line bg-white p-6'
				: 'hidden'} lg:static lg:flex lg:flex-row lg:items-center lg:gap-7 lg:border-0 lg:bg-transparent lg:p-0"
		>
			{#each navLinks as link (link.href)}
				<a href={link.href} class="hover:text-accent-700" onclick={() => (open = false)}>{link.label}</a>
			{/each}
			<div class="lg:hidden">
				<Button href="/#konsultasi" onclick={() => (open = false)}>
					Konsultasi Trip <span aria-hidden="true">↗</span>
				</Button>
			</div>
		</nav>

		<div class="hidden lg:block">
			<Button href="/#konsultasi">Konsultasi Trip <span aria-hidden="true">↗</span></Button>
		</div>

		<button
			type="button"
			class="cursor-pointer border-0 bg-transparent text-2xl lg:hidden"
			aria-label={open ? 'Tutup menu' : 'Buka menu'}
			aria-expanded={open}
			aria-controls="{menuId}-nav"
			onclick={() => (open = !open)}>{open ? '✕' : '☰'}</button
		>
	</div>
</header>
