<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { GOOGLE_REVIEWS_URL } from '#lib/content/reviews.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const rowError = (id: number) => (form && 'error' in form && form.id === id ? form.error : '');
	const summaryForm = $derived(form && 'summaryError' in form ? form : null);
	const last = $derived(data.items.length - 1);
</script>

<svelte:head><title>Kelola ulasan | Admin Lembang Adventure</title></svelte:head>

<div class="flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="text-2xl font-black tracking-tight">Kelola ulasan</h1>
		<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
			Tempel ulasan asli dari
			<a href={GOOGLE_REVIEWS_URL} class="font-bold underline" target="_blank" rel="noopener noreferrer">Loox Travel - PT Loox Travel Luxury</a>.
			Jangan menulis nama, nilai, atau teks yang tidak ada di Google. Tanggal boleh dikosongkan. Bagian ulasan tampil bila ada minimal satu ulasan.
			Google Places API tidak dipakai.
		</p>
	</div>
	<Button href="/admin/ulasan/baru" variant="accent">Tambah ulasan</Button>
</div>

<form method="POST" action="?/ringkasan" class="mt-6 grid max-w-lg gap-4 rounded-xl border border-line bg-white p-5 sm:p-7">
	<h2 class="text-sm font-extrabold tracking-wide uppercase">Ringkasan di beranda</h2>
	<p class="text-[11px] leading-relaxed text-muted">Tampil di bawah kalkulator, misalnya 5.0 dari 41 ulasan Google. Perbarui saat angka di Google berubah. Ini teks biasa, bukan data terstruktur.</p>
	<label class="grid gap-1 text-[11px] font-bold">
		Nilai
		<input name="google_rating" required inputmode="decimal" value={summaryForm ? summaryForm.googleRating : data.googleRating} class="rounded-lg border border-line px-3 py-2 text-xs font-normal" />
	</label>
	<label class="grid gap-1 text-[11px] font-bold">
		Jumlah ulasan
		<input name="google_review_count" required inputmode="numeric" value={summaryForm ? summaryForm.googleReviewCount : data.googleReviewCount} class="rounded-lg border border-line px-3 py-2 text-xs font-normal" />
	</label>
	{#if summaryForm}<p role="alert" class="text-[11px] font-semibold text-danger">{summaryForm.summaryError}</p>{/if}
	<div><Button type="submit" variant="accent">Simpan ringkasan</Button></div>
</form>

{#if form && 'ok' in form && form.ok}
	<p role="status" class="mt-5 rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{form.notice}</p>
{/if}

{#if data.items.length === 0}
	<p class="mt-6 rounded-xl border border-line bg-white p-6 text-xs text-muted">Belum ada ulasan. Salin dari Google, jangan mengarang.</p>
{:else}
	<ul class="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
		{#each data.items as item, i (item.id)}
			<li class="grid gap-3 p-4 sm:p-5">
				<div>
					<strong class="text-sm">{item.reviewer_name}</strong>
					<span class="text-[11px] text-muted"> · {item.rating}/5{#if item.review_date} · {item.review_date}{/if}</span>
					<p class="mt-2 text-xs leading-relaxed">{item.body}</p>
				</div>
				<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
					<Button href="/admin/ulasan/{item.id}" variant="outline" class="!px-4 !py-2">Ubah</Button>
					<form method="POST" action="?/naik">
						<input type="hidden" name="id" value={item.id} />
						<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === 0}>Naik</Button>
					</form>
					<form method="POST" action="?/turun">
						<input type="hidden" name="id" value={item.id} />
						<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === last}>Turun</Button>
					</form>
					<form
						method="POST"
						action="?/hapus"
						class="ml-auto"
						onsubmit={(e) => {
							if (!confirm(`Hapus ulasan ${item.reviewer_name}?`)) {
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
			</li>
		{/each}
	</ul>
{/if}
