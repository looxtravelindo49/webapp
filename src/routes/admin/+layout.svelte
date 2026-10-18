<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-cream text-green-900">
	{#if data.user}
		<header class="on-dark bg-green-900 text-white">
			<div class="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3.5">
				<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
					<a href="/admin" class="flex items-center gap-2.5 leading-none">
						<span class="text-lg font-black tracking-[-0.05em]">Lembang <span class="font-medium">Adventures</span></span>
						<span class="rounded-sm bg-accent px-1.5 py-1 text-[9px] font-extrabold tracking-wider text-green-900">ADMIN</span>
					</a>
					{#if !data.user.must_change_password}
						<nav aria-label="Navigasi admin" class="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold">
							<a href="/admin" class="hover:text-accent">Beranda</a>
							<a href="/admin/paket" class="hover:text-accent">Paket</a>
							<a href="/admin/artikel" class="hover:text-accent">Artikel</a>
							<a href="/admin/pengaturan" class="hover:text-accent">Pengaturan</a>
							<a href="/admin/akun" class="hover:text-accent">Akun</a>
							<a href="/" class="hover:text-accent" target="_blank" rel="noopener">Lihat situs ↗</a>
						</nav>
					{/if}
				</div>
				<div class="flex items-center gap-3 text-xs">
					<span class="text-green-100">Masuk sebagai <strong class="text-white">{data.user.login}</strong></span>
					<form method="POST" action="/admin/logout">
						<Button variant="accent" type="submit" class="!px-4 !py-2">Keluar</Button>
					</form>
				</div>
			</div>
		</header>
	{/if}
	<main id="main" class="wrap py-8 sm:py-12">
		{@render children()}
	</main>
</div>
