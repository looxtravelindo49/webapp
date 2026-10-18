<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { formatDate } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const rowError = (id: number) => (form && 'error' in form && form.id === id ? form.error : '');
</script>

<svelte:head><title>Kelola artikel | Admin Lembang Adventures</title></svelte:head>

<div class="flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="text-2xl font-black tracking-tight">Kelola artikel</h1>
		<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
			Hanya artikel berstatus <strong>Terbit</strong> yang tampil di situs. Beranda menampilkan tiga artikel <strong>Populer</strong>; bila kurang dari tiga, sisanya diisi artikel terbit terbaru.
		</p>
	</div>
	<Button href="/admin/artikel/baru" variant="accent">Tambah artikel</Button>
</div>

{#if form && 'ok' in form && form.ok}
	<p role="status" class="mt-5 rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{form.notice}</p>
{/if}

{#if data.articles.length === 0}
	<p class="mt-6 rounded-xl border border-line bg-white p-6 text-xs text-muted">Belum ada artikel. <a href="/admin/artikel/baru" class="font-bold underline">Tambah artikel</a> pertama.</p>
{:else}
	<ul class="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
		{#each data.articles as a (a.id)}
			<li class="grid gap-3 p-4 sm:p-5" data-article={a.slug}>
				<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div class="flex min-w-0 flex-wrap items-center gap-2">
						<strong class="text-sm">{a.title}</strong>
						<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {a.published ? 'bg-green-100' : 'bg-accent'}">{a.published ? 'Terbit' : 'Draf'}</span>
						{#if a.featured}<span class="rounded-full border border-green-900 px-2 py-0.5 text-[10px] font-bold">Populer</span>{/if}
					</div>
					<span class="text-[11px] text-muted">{a.category}{a.publishedAt ? ` · terbit ${formatDate(a.publishedAt)}` : ''}</span>
				</div>

				<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
					<Button href="/admin/artikel/{a.id}" variant="outline" class="!px-4 !py-2">Ubah</Button>

					<form method="POST" action="?/terbit">
						<input type="hidden" name="id" value={a.id} />
						<Button type="submit" variant="outline" class="!px-4 !py-2">{a.published ? 'Sembunyikan' : 'Terbitkan'}</Button>
					</form>

					<form method="POST" action="?/populer">
						<input type="hidden" name="id" value={a.id} />
						<Button type="submit" variant="outline" class="!px-4 !py-2">{a.featured ? 'Lepas populer' : 'Jadikan populer'}</Button>
					</form>

					<form
						method="POST"
						action="?/hapus"
						class="ml-auto"
						onsubmit={(e) => {
							if (!confirm(`Hapus artikel "${a.title}"? Tindakan ini tidak bisa dibatalkan.`)) {
								e.preventDefault();
								return;
							}
							// Server menolak penghapusan tanpa tanda ini (lihat action `hapus`).
							(e.currentTarget.elements.namedItem('confirm') as HTMLInputElement).value = 'yes';
						}}
					>
						<input type="hidden" name="id" value={a.id} />
						<input type="hidden" name="confirm" value="" />
						<Button type="submit" variant="danger" class="!px-4 !py-2">Hapus</Button>
					</form>
				</div>
				{#if rowError(a.id)}<p role="alert" class="text-[11px] font-semibold text-danger">{rowError(a.id)}</p>{/if}
			</li>
		{/each}
	</ul>
{/if}
