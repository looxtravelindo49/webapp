<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import { formatRupiah } from '#lib/format.js';
	import type { InvoiceFormRow, InvoiceFormSeed } from '#lib/invoice-form.js';
	import { DEFAULT_FEE_LABEL, DP_PERCENT, dpCaption, manualQuote, parsePercentHundredths, parsePercentPoints, parseReceivedAmount, type DpSpec, type FeeSpec } from '#lib/invoice.js';
	import { manualPackagePrefill } from '#lib/pricing.js';

	type PackageOption = {
		slug: string;
		title: string;
		price: number | null;
		pricing_mode?: 'per_person' | 'per_unit' | null;
		kapasitas_per_unit?: number | null;
		nama_unit?: string | null;
	};

	let {
		packages,
		seed,
		message = '',
		submitLabel = 'Simpan invoice'
	}: {
		packages: PackageOption[];
		seed: InvoiceFormSeed;
		message?: string;
		submitLabel?: string;
	} = $props();

	type Row = InvoiceFormRow & { id: number };
	let rowSeq = 1;
	const field = 'rounded-md border border-line px-3 py-2.5 text-xs font-normal';

	function cloneRows(list: readonly InvoiceFormRow[]): Row[] {
		const rows = list.map((row) => ({ ...row, id: rowSeq++ }));
		return rows.length > 0 ? rows : [{ ...blank(), id: rowSeq++ }];
	}

	function blank(partial: Partial<InvoiceFormRow> = {}): InvoiceFormRow {
		return {
			deskripsi: '',
			qty: '1',
			harga: '',
			unitName: '',
			capacity: '',
			include: '',
			slug: '',
			kind: 'bebas',
			flat: '',
			minPax: '1',
			...partial
		};
	}

	function apply(next: InvoiceFormSeed) {
		nama = next.nama;
		perusahaan = next.perusahaan;
		whatsapp = next.whatsapp;
		tanggal = next.tanggal;
		jumlahPeserta = next.jumlahPeserta;
		catatan = next.catatan;
		diskon = next.diskon;
		feeAktif = next.feeAktif;
		feeLabel = next.feeLabel || DEFAULT_FEE_LABEL;
		feeMode = next.feeMode;
		feeNilai = next.feeNilai;
		dpMode = next.dpMode;
		dpNilai = next.dpNilai;
		rows = cloneRows(next.rows);
	}

	const initial = untrack(() => seed);
	let nama = $state(initial.nama);
	let perusahaan = $state(initial.perusahaan);
	let whatsapp = $state(initial.whatsapp);
	let tanggal = $state(initial.tanggal);
	let jumlahPeserta = $state(initial.jumlahPeserta);
	let catatan = $state(initial.catatan);
	let diskon = $state(initial.diskon);
	let feeAktif = $state(initial.feeAktif);
	let feeLabel = $state(initial.feeLabel || DEFAULT_FEE_LABEL);
	let feeMode = $state<'persen' | 'nominal'>(initial.feeMode);
	let feeNilai = $state(initial.feeNilai);
	let dpMode = $state<'persen' | 'nominal'>(initial.dpMode);
	let dpNilai = $state(initial.dpNilai);
	let rows = $state<Row[]>(cloneRows(initial.rows));
	let applied = $state(initial.token);
	let paket = $state('');

	$effect(() => {
		const token = seed.token;
		if (applied === token) return;
		applied = token;
		apply(seed);
	});

	const quote = $derived.by(() => {
		const lines: { qty: number; harga: number }[] = [];
		for (const row of rows) {
			if (!row.deskripsi.trim() && !row.qty.trim() && !row.harga.trim() && !row.include.trim()) continue;
			if (!/^\d+$/.test(row.qty.trim())) return null;
			const price = parseReceivedAmount(row.harga);
			if (!price.ok || price.value === null) return null;
			lines.push({ qty: Number(row.qty.trim()), harga: price.value });
		}
		const potongan = parseReceivedAmount(diskon);
		if (!potongan.ok) return null;
		let fee: FeeSpec | null = null;
		if (feeAktif) {
			if (feeMode === 'nominal') {
				const amount = parseReceivedAmount(feeNilai);
				if (!amount.ok || amount.value === null || amount.value < 1) return null;
				fee = { mode: 'nominal', value: amount.value };
			} else {
				const percent = parsePercentHundredths(feeNilai);
				if (!percent.ok || percent.value < 1) return null;
				fee = { mode: 'persen', value: percent.value };
			}
		}
		let dp: DpSpec | null = null;
		if (dpMode === 'nominal') {
			const amount = parseReceivedAmount(dpNilai);
			if (!amount.ok || amount.value === null) return null;
			dp = { mode: 'nominal', value: amount.value };
		} else {
			const percent = parsePercentPoints(dpNilai);
			if (!percent.ok) return null;
			dp = { mode: 'persen', value: percent.value };
		}
		return manualQuote(lines, potongan.value ?? 0, { fee, dp });
	});

	function addRow() {
		rows = [...rows, { ...blank(), id: rowSeq++ }];
	}

	function removeRow(id: number) {
		const next = rows.filter((row) => row.id !== id);
		rows = next.length === 0 ? [{ ...blank(), id: rowSeq++ }] : next;
	}

	function addPackage(slug: string) {
		paket = '';
		const picked = packages.find((item) => item.slug === slug);
		if (!picked) return;
		const filled = manualPackagePrefill(
			{
				title: picked.title,
				price: picked.price,
				pricing_mode: picked.pricing_mode === 'per_unit' ? 'per_unit' : 'per_person',
				kapasitas_per_unit: picked.kapasitas_per_unit,
				nama_unit: picked.nama_unit
			},
			jumlahPeserta
		);
		const row: Row = {
			...blank({
				deskripsi: filled.deskripsi,
				qty: filled.qty,
				harga: filled.harga,
				unitName: filled.unitName,
				capacity: filled.capacity,
				slug: picked.slug,
				kind: 'paket'
			}),
			id: rowSeq++
		};
		const empty = rows.length === 1 && !rows[0].deskripsi.trim() && !rows[0].harga.trim() && !rows[0].include.trim();
		rows = empty ? [row] : [...rows, row];
	}

</script>

<form method="POST" class="mt-6 grid max-w-3xl gap-4">
	<div class="grid gap-4 rounded-xl border border-line bg-white p-5 sm:grid-cols-2 sm:p-6">
		<label class="grid gap-1 text-[11px] font-semibold" for="nama">
			Nama klien
			<input id="nama" name="nama" required maxlength="100" bind:value={nama} class={field} />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold" for="perusahaan">
			Perusahaan (opsional)
			<input id="perusahaan" name="perusahaan" maxlength="120" bind:value={perusahaan} class={field} />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold" for="whatsapp">
			No. WA
			<input id="whatsapp" name="whatsapp" required inputmode="tel" autocomplete="tel" placeholder="081234567890" bind:value={whatsapp} class={field} />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold" for="tanggal">
			Tanggal acara
			<input id="tanggal" name="tanggal" type="date" bind:value={tanggal} class={field} />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold" for="jumlahPeserta">
			Jumlah peserta
			<input id="jumlahPeserta" name="jumlahPeserta" required inputmode="numeric" bind:value={jumlahPeserta} class={field} />
		</label>
		<label class="grid gap-1 text-[11px] font-semibold sm:col-span-2" for="catatan">
			Catatan
			<textarea id="catatan" name="catatan" rows="3" maxlength="1500" bind:value={catatan} class={field}></textarea>
		</label>
	</div>

	<div class="rounded-xl border border-line bg-white p-5 sm:p-6">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<h2 class="text-sm font-black">Baris tagihan</h2>
			{#if packages.length > 0}
				<label class="grid gap-1 text-[11px] font-semibold" for="paket-jadi">
					Tambah dari paket
					<select
						id="paket-jadi"
						bind:value={paket}
						onchange={(event) => addPackage(event.currentTarget.value)}
						class="rounded-md border border-line bg-white px-3 py-2 text-xs font-normal"
					>
						<option value="">Pilih paket…</option>
						{#each packages as item (item.slug)}
							<option value={item.slug}>{item.title}{item.price === null ? ' · harga menyusul' : ''}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>

		<ul class="mt-4 grid gap-4">
			{#each rows as row (row.id)}
				<li class="grid gap-2 border-t border-line pt-3">
					<div class="grid gap-2 sm:grid-cols-[1fr_5rem_8rem_auto] sm:items-end">
						<label class="grid gap-1 text-[11px] font-semibold">
							Deskripsi
							<input name="deskripsi" bind:value={row.deskripsi} maxlength="200" class={field} />
						</label>
						<label class="grid gap-1 text-[11px] font-semibold">
							Qty
							<input name="qty" inputmode="numeric" bind:value={row.qty} class={field} />
						</label>
						<label class="grid gap-1 text-[11px] font-semibold">
							Harga satuan
							<input name="harga" inputmode="numeric" bind:value={row.harga} placeholder="249000" class={field} />
						</label>
						<Button type="button" variant="outline" class="!px-3 !py-2" onclick={() => removeRow(row.id)}>Hapus</Button>
					</div>
					<input type="hidden" name="satuan" value={row.unitName} />
					<input type="hidden" name="kapasitas" value={row.capacity} />
					<input type="hidden" name="slug" value={row.slug} />
					<input type="hidden" name="kind" value={row.kind} />
					<input type="hidden" name="flat" value={row.flat} />
					<input type="hidden" name="min_pax" value={row.minPax} />
					<label class="grid gap-1 text-[11px] font-semibold">
						Include
						<textarea
							name="include"
							rows="2"
							maxlength="2000"
							bind:value={row.include}
							placeholder="Satu butir per baris. Contoh: Jeep, pemandu, makan siang"
							class={field}
						></textarea>
					</label>
				</li>
			{/each}
		</ul>
		<div class="mt-3"><Button type="button" variant="outline" onclick={addRow}>Tambah baris</Button></div>

		<label class="mt-5 grid max-w-xs gap-1 text-[11px] font-semibold" for="diskon">
			Diskon (opsional)
			<input id="diskon" name="diskon" inputmode="numeric" bind:value={diskon} placeholder="0" class={field} />
		</label>

		<fieldset class="mt-5 grid gap-3 border-t border-line pt-4">
			<legend class="text-[11px] font-bold tracking-wide uppercase">Fee Services</legend>
			<label class="flex items-center gap-2 text-[11px] font-semibold">
				<input type="checkbox" name="fee_aktif" value="1" bind:checked={feeAktif} />
				Tambahkan baris Fee Services
			</label>
			{#if feeAktif}
				<label class="grid max-w-sm gap-1 text-[11px] font-semibold" for="fee_label">
					Judul baris
					<input id="fee_label" name="fee_label" maxlength="80" bind:value={feeLabel} class={field} />
				</label>
				<div class="flex flex-wrap gap-4 text-[11px] font-semibold">
					<label class="flex items-center gap-2">
						<input type="radio" name="fee_mode" value="persen" bind:group={feeMode} />
						Persen
					</label>
					<label class="flex items-center gap-2">
						<input type="radio" name="fee_mode" value="nominal" bind:group={feeMode} />
						Nominal tetap
					</label>
				</div>
				<label class="grid max-w-xs gap-1 text-[11px] font-semibold" for="fee_nilai">
					{feeMode === 'persen' ? 'Persen (contoh 10 atau 10,5)' : 'Nominal rupiah'}
					<input id="fee_nilai" name="fee_nilai" inputmode="decimal" bind:value={feeNilai} class={field} />
				</label>
				<p class="text-[11px] leading-[1.7] text-muted">Persen dihitung dari subtotal setelah diskon, lalu masuk ke total.</p>
			{/if}
		</fieldset>

		<fieldset class="mt-5 grid gap-3 border-t border-line pt-4">
			<legend class="text-[11px] font-bold tracking-wide uppercase">Uang muka (DP)</legend>
			<p class="text-[11px] leading-[1.7] text-muted">
				Bawaan {DP_PERCENT}% dari total. Ganti persen atau isi nominal untuk mengunci DP invoice ini.
			</p>
			<div class="flex flex-wrap gap-4 text-[11px] font-semibold">
				<label class="flex items-center gap-2">
					<input type="radio" name="dp_mode" value="persen" bind:group={dpMode} />
					Persen
				</label>
				<label class="flex items-center gap-2">
					<input
						type="radio"
						name="dp_mode"
						value="nominal"
						bind:group={dpMode}
						onclick={() => {
							if (dpMode === 'persen') dpNilai = '';
						}}
					/>
					Nominal tetap
				</label>
			</div>
			<label class="grid max-w-xs gap-1 text-[11px] font-semibold" for="dp_nilai">
				{dpMode === 'persen' ? 'Persen DP' : 'Nominal DP'}
				<input id="dp_nilai" name="dp_nilai" inputmode="numeric" bind:value={dpNilai} class={field} />
			</label>
		</fieldset>

		<div class="mt-4 text-xs">
			{#if quote}
				<p>Subtotal <strong>{formatRupiah(quote.subtotal)}</strong></p>
				{#if quote.diskon > 0}<p>Diskon <strong>− {formatRupiah(quote.diskon)}</strong></p>{/if}
				{#if quote.fee > 0}<p>{feeLabel.trim() || DEFAULT_FEE_LABEL} <strong>{formatRupiah(quote.fee)}</strong></p>{/if}
				<p class="mt-1 text-base font-black">Total {formatRupiah(quote.total)}</p>
				<p class="font-bold">{dpCaption(quote.dpMode, quote.dpPersen)} {formatRupiah(quote.dp)}</p>
			{:else}
				<p class="text-muted">Lengkapi baris untuk melihat total. Angka akhir tetap dihitung saat disimpan.</p>
			{/if}
		</div>
	</div>

	{#if message}<p role="alert" class="text-[11px] font-semibold text-danger">{message}</p>{/if}
	<div><Button type="submit" variant="primary">{submitLabel}</Button></div>
</form>
