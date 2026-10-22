<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import PortfolioUploader from '#lib/components/admin/PortfolioUploader.svelte';
	import { PORTFOLIO_LIMITS } from '#lib/portfolio-form.js';
	import { optionalImage } from '#lib/images.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const rowError = (id: number) => (form && 'error' in form && form.id === id ? form.error : '');
	const last = $derived(data.items.length - 1);
</script>

<svelte:head><title>Kelola portfolio | Admin Lembang Adventure</title></svelte:head>

<div>
	<h1 class="text-2xl font-black tracking-tight">Kelola portfolio</h1>
	<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
		Galeri foto untuk <a href="/portfolio" class="font-bold underline">/portfolio</a>. Setiap foto butuh teks alternatif. Keterangan singkat boleh dikosongkan.
	</p>
</div>

{#if form && 'error' in form && form.error && !('id' in form && form.id)}
	<p role="alert" class="mt-5 rounded-md border border-danger bg-white px-4 py-3 text-xs font-semibold text-danger">{form.error}</p>
{/if}
{#if form && 'ok' in form && form.ok}
	<p role="status" class="mt-5 rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{form.notice}</p>
{/if}

<div class="mt-6 max-w-3xl">
	<PortfolioUploader />
</div>

{#if data.items.length === 0}
	<p class="mt-6 rounded-xl border border-line bg-white p-6 text-xs text-muted">Belum ada foto.</p>
{:else}
	<ul class="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
		{#each data.items as item, i (item.id)}
			<li class="grid gap-3 p-4 sm:grid-cols-[7rem_1fr] sm:p-5">
				{#if optionalImage(item.image)}
					<img src={optionalImage(item.image)} alt="" class="aspect-[4/3] w-full rounded-lg object-cover sm:w-28" />
				{/if}
				<div class="grid gap-3">
					<form method="POST" action="?/teks" class="grid gap-3">
						<input type="hidden" name="id" value={item.id} />
						<label class="grid gap-1 text-[11px] font-bold">
							Teks alternatif
							<input name="alt" required maxlength={PORTFOLIO_LIMITS.alt} value={item.alt} class="rounded-lg border border-line px-3 py-2 text-xs font-normal" />
						</label>
						<label class="grid gap-1 text-[11px] font-bold">
							Keterangan singkat (opsional)
							<input name="caption" maxlength={PORTFOLIO_LIMITS.caption} value={item.caption ?? ''} class="rounded-lg border border-line px-3 py-2 text-xs font-normal" />
						</label>
						<div><Button type="submit" variant="outline" class="!px-4 !py-2">Simpan teks</Button></div>
					</form>
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<form method="POST" action="?/naik">
							<input type="hidden" name="id" value={item.id} />
							<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === 0} aria-label="Naikkan foto {i + 1}">Naik</Button>
						</form>
						<form method="POST" action="?/turun">
							<input type="hidden" name="id" value={item.id} />
							<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === last} aria-label="Turunkan foto {i + 1}">Turun</Button>
						</form>
						<form
							method="POST"
							action="?/hapus"
							class="ml-auto"
							onsubmit={(e) => {
								if (!confirm('Hapus foto ini?')) {
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
