<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { formatRupiah } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const rowError = (id: number) => (form && 'error' in form && form.id === id ? form.error : '');
	const last = $derived(data.packages.length - 1);
</script>

<svelte:head><title>Kelola paket | Admin Lembang Adventures</title></svelte:head>

<div class="flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="text-2xl font-black tracking-tight">Kelola paket</h1>
		<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
			Hanya paket berstatus <strong>Terbit</strong> yang tampil di situs dan kalkulator, sesuai urutan di bawah.
		</p>
	</div>
	<Button href="/admin/paket/baru" variant="accent">Tambah paket</Button>
</div>

{#if form && 'ok' in form && form.ok}
	<p role="status" class="mt-5 rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{form.notice}</p>
{/if}

{#if data.packages.length === 0}
	<p class="mt-6 rounded-xl border border-line bg-white p-6 text-xs text-muted">Belum ada paket. Tambahkan paket pertama.</p>
{:else}
	<ul class="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
		{#each data.packages as p, i (p.id)}
			<li class="grid gap-3 p-4 sm:p-5" data-package={p.slug}>
				<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div class="flex min-w-0 flex-wrap items-center gap-2">
						<strong class="text-sm">{p.title}</strong>
						<span class="rounded-full px-2 py-0.5 text-[10px] font-bold {p.published ? 'bg-green-100' : 'bg-accent'}">{p.published ? 'Terbit' : 'Draft'}</span>
					</div>
					<span class="text-[11px] text-muted">
						{p.price === null ? 'Harga menyusul' : `${formatRupiah(p.price)} / orang`} · min. {p.minPax} peserta{p.unitLabel ? ` · ${p.unitLabel}` : ''}
					</span>
				</div>

				<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
					<Button href="/admin/paket/{p.id}" variant="outline" class="!px-4 !py-2">Ubah</Button>

					<form method="POST" action="?/terbit">
						<input type="hidden" name="id" value={p.id} />
						<Button type="submit" variant="outline" class="!px-4 !py-2">{p.published ? 'Sembunyikan' : 'Terbitkan'}</Button>
					</form>

					<form method="POST" action="?/naik">
						<input type="hidden" name="id" value={p.id} />
						<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === 0} aria-label="Naikkan {p.title}">Naik</Button>
					</form>
					<form method="POST" action="?/turun">
						<input type="hidden" name="id" value={p.id} />
						<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === last} aria-label="Turunkan {p.title}">Turun</Button>
					</form>

					<form
						method="POST"
						action="?/hapus"
						class="ml-auto"
						onsubmit={(e) => {
							if (!confirm(`Hapus paket "${p.title}"? Tindakan ini tidak bisa dibatalkan.`)) {
								e.preventDefault();
								return;
							}
							// Server menolak penghapusan tanpa tanda ini (lihat action `hapus`).
							(e.currentTarget.elements.namedItem('confirm') as HTMLInputElement).value = 'yes';
						}}
					>
						<input type="hidden" name="id" value={p.id} />
						<input type="hidden" name="confirm" value="" />
						<Button type="submit" variant="danger" class="!px-4 !py-2">Hapus</Button>
					</form>
				</div>
				{#if rowError(p.id)}<p role="alert" class="text-[11px] font-semibold text-danger">{rowError(p.id)}</p>{/if}
			</li>
		{/each}
	</ul>
{/if}
