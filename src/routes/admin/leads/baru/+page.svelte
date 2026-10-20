<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import { formatRupiah } from '#lib/format.js';
	import { DP_PERCENT, manualQuote, parseReceivedAmount } from '#lib/invoice.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Row = { id: number; deskripsi: string; qty: string; harga: string };
	let rowSeq = 1;
	const blankRow = (partial: Partial<Row> = {}): Row => ({ id: rowSeq++, deskripsi: '', qty: '1', harga: '', ...partial });

	const failed = $derived(form && 'message' in form ? form : null);

	function rowsFromForm(): Row[] {
		if (!failed || !('deskripsi' in failed)) return [blankRow()];
		const count = Math.max(failed.deskripsi.length, failed.qty.length, failed.harga.length, 1);
		return Array.from({ length: count }, (_, i) =>
			blankRow({ deskripsi: failed.deskripsi[i] ?? '', qty: failed.qty[i] ?? '1', harga: failed.harga[i] ?? '' })
		);
	}

	let nama = $state('');
	let perusahaan = $state('');
	let whatsapp = $state('');
	let tanggal = $state('');
	let jumlahPeserta = $state('');
	let catatan = $state('');
	let diskon = $state('');
	let rows = $state<Row[]>([blankRow()]);
	let paket = $state('');
	let restored = $state(false);

	$effect(() => {
		if (restored || !failed || !('deskripsi' in failed)) return;
		restored = true;
		nama = failed.nama;
		perusahaan = failed.perusahaan;
		whatsapp = failed.whatsapp;
		tanggal = failed.tanggal;
		jumlahPeserta = failed.jumlahPeserta;
		catatan = failed.catatan;
		diskon = failed.diskon;
		rows = rowsFromForm();
	});

	const quote = $derived.by(() => {
		const lines: { qty: number; harga: number }[] = [];
		for (const row of rows) {
			if (!row.deskripsi.trim() && !row.qty.trim() && !row.harga.trim()) continue;
			if (!/^\d+$/.test(row.qty.trim())) return null;
			const price = parseReceivedAmount(row.harga);
			if (!price.ok || price.value === null) return null;
			lines.push({ qty: Number(row.qty.trim()), harga: price.value });
		}
		const potongan = parseReceivedAmount(diskon);
		if (!potongan.ok) return null;
		return manualQuote(lines, potongan.value ?? 0);
	});

	function addRow() {
		rows = [...rows, blankRow()];
	}

	function removeRow(id: number) {
		const next = rows.filter((row) => row.id !== id);
		rows = next.length === 0 ? [blankRow()] : next;
	}

	function addPackage(slug: string) {
		paket = '';
		const picked = data.packages.find((p) => p.slug === slug);
		if (!picked) return;
		const row = blankRow({
			deskripsi: picked.title,
			qty: jumlahPeserta.trim() || '1',
			harga: picked.price === null ? '' : String(picked.price)
		});
		const blank = rows.length === 1 && !rows[0].deskripsi.trim() && !rows[0].harga.trim();
		rows = blank ? [row] : [...rows, row];
	}
</script>

<svelte:head><title>Buat Invoice Manual | Leads</title></svelte:head>

<p class="text-[11px] font-bold"><a href="/admin/leads" class="underline">Kembali ke Leads</a></p>
<h1 class="mt-3 text-2xl font-black tracking-tight">Buat Invoice Manual</h1>
<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
	Invoice ini masuk ke daftar Leads dengan nomor yang sama seperti kalkulator. Total dan DP {DP_PERCENT}% dihitung di server.
</p>

<form method="POST" class="mt-6 grid max-w-3xl gap-4">
	<div class="grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2 sm:p-6">
		<label class="grid gap-1 text-[11px] font-semibold" for="nama">
			Nama klien
			<input id="nama" name="nama" required maxlength="100" bind:value={nama} class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold" for="perusahaan">
			Perusahaan (opsional)
			<input id="perusahaan" name="perusahaan" maxlength="120" bind:value={perusahaan} class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold" for="whatsapp">
			No. WA
			<input id="whatsapp" name="whatsapp" required inputmode="tel" autocomplete="tel" placeholder="081234567890" bind:value={whatsapp} class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold" for="tanggal">
			Tanggal acara
			<input id="tanggal" name="tanggal" type="date" bind:value={tanggal} class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold" for="jumlahPeserta">
			Jumlah peserta
			<input id="jumlahPeserta" name="jumlahPeserta" required inputmode="numeric" bind:value={jumlahPeserta} class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold sm:col-span-2" for="catatan">
			Catatan
			<textarea id="catatan" name="catatan" rows="3" maxlength="1500" bind:value={catatan} class="rounded-md border border-line px-3 py-2.5 text-xs font-normal"></textarea>
		</label>
	</div>

	<div class="rounded-xl border border-line bg-white p-5 sm:p-6">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<h2 class="text-sm font-black">Baris tagihan</h2>
			{#if data.packages.length > 0}
				<label class="grid gap-1 text-[11px] font-semibold" for="paket-jadi">
					Tambah dari paket
					<select
						id="paket-jadi"
						bind:value={paket}
						onchange={(event) => addPackage(event.currentTarget.value)}
						class="rounded-md border border-line bg-white px-3 py-2 text-xs font-normal"
					>
						<option value="">Pilih paket…</option>
						{#each data.packages as item (item.slug)}
							<option value={item.slug}>{item.title}{item.price === null ? ' · harga menyusul' : ''}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<ul class="mt-4 grid gap-3">
			{#each rows as row (row.id)}
				<li class="grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end">
					<label class="grid gap-1 text-[11px] font-semibold">
						Deskripsi
						<input name="deskripsi" bind:value={row.deskripsi} maxlength="200" class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
					</label>
					<label class="grid gap-1 text-[11px] font-semibold">
						Qty
						<input name="qty" inputmode="numeric" bind:value={row.qty} class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
					</label>
					<label class="grid gap-1 text-[11px] font-semibold">
						Harga satuan
						<input name="harga" inputmode="numeric" bind:value={row.harga} placeholder="249000" class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
					</label>
					<Button type="button" variant="outline" class="!px-3 !py-2" onclick={() => removeRow(row.id)}>Hapus</Button>
				</li>
			{/each}
		</ul>
		<div class="mt-3"><Button type="button" variant="outline" onclick={addRow}>Tambah baris</Button></div>

		<label class="mt-5 grid max-w-xs gap-1 text-[11px] font-semibold" for="diskon">
			Diskon (opsional)
			<input id="diskon" name="diskon" inputmode="numeric" bind:value={diskon} placeholder="0" class="rounded-md border border-line px-3 py-2.5 text-xs font-normal" />
		</label>

		<div class="mt-4 text-xs">
			{#if quote}
				<p>Subtotal <strong>{formatRupiah(quote.subtotal)}</strong></p>
				{#if quote.diskon > 0}<p>Diskon <strong>− {formatRupiah(quote.diskon)}</strong></p>{/if}
				<p class="mt-1 text-base font-black">Total {formatRupiah(quote.total)}</p>
				<p class="font-bold">DP {DP_PERCENT}% {formatRupiah(quote.dp)}</p>
			{:else}
				<p class="text-muted">Lengkapi baris untuk melihat total. Angka akhir tetap dihitung saat disimpan.</p>
			{/if}
		</div>
	</div>

	{#if failed}<p role="alert" class="text-[11px] font-semibold text-danger">{failed.message}</p>{/if}
	<div><Button type="submit" variant="primary">Simpan invoice</Button></div>
</form>
