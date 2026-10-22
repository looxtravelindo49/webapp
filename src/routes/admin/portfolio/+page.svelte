<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { optionalImage } from '#lib/images.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const rowError = (id: number) => (form && 'error' in form && form.id === id ? form.error : '');
	const last = $derived(data.items.length - 1);
</script>

<svelte:head><title>Kelola portfolio | Admin Lembang Adventure</title></svelte:head>

<div class="flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="text-2xl font-black tracking-tight">Kelola portfolio</h1>
		<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
			Foto yang diunggah disimpan sebagai WebP (sisi terpanjang 1600 piksel, di bawah 300 KB) dan tampil di <a href="/portfolio" class="font-bold underline">/portfolio</a>.
			Item tanpa foto menampilkan tulisan "Foto segera".
		</p>
	</div>
	<Button href="/admin/portfolio/baru" variant="accent">Tambah dokumentasi</Button>
</div>

{#if form && 'ok' in form && form.ok}
	<p role="status" class="mt-5 rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{form.notice}</p>
{/if}

{#if data.items.length === 0}
	<p class="mt-6 rounded-xl border border-line bg-white p-6 text-xs text-muted">Belum ada dokumentasi.</p>
{:else}
	<ul class="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
		{#each data.items as item, i (item.id)}
			<li class="grid gap-3 p-4 sm:grid-cols-[7rem_1fr] sm:p-5">
				{#if optionalImage(item.image)}
					<img src={optionalImage(item.image)} alt="" class="aspect-[4/3] w-full rounded-lg object-cover sm:w-28" />
				{:else}
					<div class="flex aspect-[4/3] items-center justify-center rounded-lg bg-cream text-[10px] font-bold text-muted sm:w-28">Foto segera</div>
				{/if}
				<div class="grid gap-3">
					<div>
						<strong class="text-sm">{item.title}</strong>
						<p class="mt-1 text-[11px] text-muted">{item.event_type} · {item.location} · {item.event_date}</p>
						<p class="mt-1 text-xs">{item.caption}</p>
					</div>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<Button href="/admin/portfolio/{item.id}" variant="outline" class="!px-4 !py-2">Ubah</Button>
						<form method="POST" action="?/naik">
							<input type="hidden" name="id" value={item.id} />
							<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === 0} aria-label="Naikkan {item.title}">Naik</Button>
						</form>
						<form method="POST" action="?/turun">
							<input type="hidden" name="id" value={item.id} />
							<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === last} aria-label="Turunkan {item.title}">Turun</Button>
						</form>
						<form
							method="POST"
							action="?/hapus"
							class="ml-auto"
							onsubmit={(e) => {
								if (!confirm(`Hapus "${item.title}"?`)) {
									e.preventDefault();
									return;
								}
								(e.currentTarget.elements.namedItem('confirm') as HTMLInputElement).value = 'yes';
							}}
						>
							<input type="hidden" name="id" value={item.id} />
							<input type="hidden" name="confirm" value="" />
							<Button type="submit" variant="danger" class="!px-4 !py-2">Hapus</Button>
						</form>
					</div>
					{#if rowError(item.id)}<p role="alert" class="text-[11px] font-semibold text-danger">{rowError(item.id)}</p>{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}
