<script lang="ts">
	import { page } from '$app/state';
	import { navLinks, site } from '#lib/content/site.js';
	import Button from './Button.svelte';

	let open = $state(false);
	const menuId = $props.id();
	// Beranda: nav transparan di atas foto hero. Halaman lain tetap bar putih lengket.
	const overlay = $derived(page.url.pathname === '/');
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<header class="print-hide {overlay ? 'hero-nav' : 'sticky top-0 z-10 border-b border-line bg-white/98'}">
	<div class={overlay ? 'hero-nav-bar' : 'wrap flex h-17.5 items-center justify-between gap-4 sm:h-21 sm:gap-7'}>
		<a href="/" class="leading-none whitespace-nowrap {overlay ? 'brand' : ''}" aria-label="{site.name} beranda">
			<span class="block {overlay ? 'name' : 'text-[22px] font-black tracking-[-0.06em] sm:text-[26px]'}"
				>Lembang <span class={overlay ? 'thin' : 'font-medium'}>Adventure</span></span
			>
			<small class={overlay ? '' : 'mt-2 block text-[8px] font-bold tracking-[0.18em] uppercase'}>{site.byline}</small>
		</a>

		<nav
			id="{menuId}-nav"
			aria-label="Navigasi utama"
			class={overlay
				? 'hero-links' + (open ? ' is-open' : '')
				: 'text-xs font-semibold ' +
					(open
						? 'absolute inset-x-0 top-17.5 flex flex-col items-start gap-5 border-b border-line bg-white p-6 sm:top-21'
						: 'hidden') +
					' lg:static lg:flex lg:flex-row lg:items-center lg:gap-7 lg:border-0 lg:bg-transparent lg:p-0'}
		>
			{#each navLinks as link (link.href)}
				<a href={link.href} class={overlay ? '' : 'hover:text-accent-700'} onclick={() => (open = false)}
					>{link.label}</a
				>
			{/each}
			<div class={overlay ? 'mobile-cta' : 'lg:hidden'}>
				<Button href="/#konsultasi" onclick={() => (open = false)}>
					Konsultasi Trip <span aria-hidden="true">↗</span>
				</Button>
			</div>
		</nav>

		{#if overlay}
			<a class="nav-cta" href="/#konsultasi">Konsultasi Trip</a>
		{:else}
			<div class="hidden lg:block">
				<Button href="/#konsultasi">Konsultasi Trip <span aria-hidden="true">↗</span></Button>
			</div>
		{/if}

		<button
			type="button"
			class={overlay ? 'menu-icon' : 'cursor-pointer border-0 bg-transparent text-2xl lg:hidden'}
			aria-label={open ? 'Tutup menu' : 'Buka menu'}
			aria-expanded={open}
			aria-controls="{menuId}-nav"
			onclick={() => (open = !open)}>{open ? '✕' : '☰'}</button
		>
	</div>
</header>

<style>
	.hero-nav {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 20;
		color: #fff;
	}
	.hero-nav-bar {
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 0 40px;
	}
	.brand,
	.hero-links,
	.nav-cta,
	.menu-icon {
		text-shadow: 0 1px 10px rgba(0, 0, 0, 0.55);
	}
	.brand {
		line-height: 1;
	}
	.name {
		display: block;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.04em;
	}
	.name .thin {
		font-weight: 500;
	}
	.brand small {
		display: block;
		margin-top: 6px;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		opacity: 0.9;
	}
	.hero-links {
		display: flex;
		align-items: center;
		gap: 28px;
		font-size: 13px;
		font-weight: 600;
	}
	.hero-links a:hover {
		color: #e5ff00;
	}
	.mobile-cta {
		display: none;
	}
	.nav-cta {
		display: inline-block;
		flex-shrink: 0;
		font-weight: 700;
		font-size: 13px;
		padding: 10px 20px;
		border-radius: 40px;
		background: transparent;
		border: 2px solid #fff;
		color: #fff;
		white-space: nowrap;
	}
	.menu-icon {
		display: none;
		font-size: 26px;
		line-height: 1;
		border: 0;
		background: none;
		color: #fff;
		padding: 0;
		cursor: pointer;
	}

	@media (max-width: 767px), (max-width: 1024px) and (orientation: portrait) {
		.hero-nav-bar {
			height: 72px;
			padding: 0 16px;
		}
		.hero-links,
		.nav-cta {
			display: none;
		}
		.menu-icon {
			display: block;
		}
		.hero-links.is-open {
			display: flex;
			position: absolute;
			top: 100%;
			left: 0;
			right: 0;
			flex-direction: column;
			align-items: flex-start;
			gap: 20px;
			padding: 24px;
			border-bottom: 1px solid var(--color-line);
			background: #fff;
			color: var(--color-green-900);
			text-shadow: none;
			font-size: 12px;
		}
		.hero-links.is-open a:hover {
			color: var(--color-accent-700);
		}
		.hero-links.is-open .mobile-cta {
			display: block;
		}
	}
</style>
