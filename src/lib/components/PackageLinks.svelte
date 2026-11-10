<script lang="ts" module>
	/** Daftar tautan biasa ke halaman paket (tautan internal untuk pengunjung dan mesin pencari). */
	export type PackageLink = { slug: string; title: string };
</script>

<script lang="ts">
	let { heading, packages }: { heading: string; packages: PackageLink[] } = $props();

	const headingId = $derived(`paket-tautan-${heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
</script>

{#if packages.length > 0}
	<nav class="mt-12 max-w-3xl border-t border-line pt-8" aria-labelledby={headingId}>
		<h2 id={headingId} class="text-lg font-black">{heading}</h2>
		<ul class="mt-3 flex flex-wrap gap-2">
			{#each packages as p (p.slug)}
				<li>
					<a
						href="/paket/{p.slug}"
						class="inline-block rounded-full border border-line bg-white px-4 py-2.5 text-sm font-bold text-green-800 hover:bg-green-100"
						>{p.title}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
{/if}
