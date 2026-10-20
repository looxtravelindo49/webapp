<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import TextArea from '#lib/components/admin/TextArea.svelte';
	import { safeImage } from '#lib/images.js';
	import { LIMITS, type PackageErrors, type PackageRaw } from '#lib/package-form.js';

	/** Batas dan jenis yang diterima di sisi klien (server tetap menjadi penentu). */
	const MAX_BYTES = 4 * 1024 * 1024;
	const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

	let {
		values,
		errors = {},
		photoError = '',
		image = null,
		submitLabel,
		isNew = false
	}: {
		values: PackageRaw;
		errors?: PackageErrors;
		/** Kesalahan dari server untuk isian foto. */
		photoError?: string;
		/** Path foto tersimpan (halaman ubah). */
		image?: string | null;
		submitLabel: string;
		isNew?: boolean;
	} = $props();

	const uid = $props.id();
	let clientPhotoError = $state('');
	const shownPhotoError = $derived(clientPhotoError || photoError);
	const photoErrId = $derived(`${uid}-photo-error`);

	function checkFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		clientPhotoError = '';
		if (!file) return;
		if (!ACCEPT.includes(file.type)) clientPhotoError = 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.';
		else if (file.size > MAX_BYTES) clientPhotoError = 'Foto terlalu besar. Maksimal 4 MB.';
		if (clientPhotoError) e.currentTarget.value = ''; // batalkan pilihan agar tidak terkirim
	}
</script>

<form method="POST" enctype="multipart/form-data" class="grid gap-5 rounded-xl border border-line bg-white p-5 sm:p-7">
	<Field label="Nama paket" name="title" value={values.title} maxlength={LIMITS.title} error={errors.title} autocomplete="off" />
	<TextArea label="Ringkasan" name="summary" value={values.summary} rows={2} maxlength={LIMITS.summary} required error={errors.summary} hint="Satu atau dua kalimat yang tampil di bawah nama paket (maks. 300 karakter)." />
	<TextArea label="Penjelasan lengkap (opsional)" name="body" value={values.body} rows={6} maxlength={LIMITS.body} error={errors.body} hint="Pisahkan paragraf dengan satu baris kosong." />
	<TextArea label="Pilihan yang dapat dibahas / fasilitas (opsional)" name="includes" value={values.includes} rows={4} maxlength={LIMITS.includes} error={errors.includes} hint="Satu butir per baris." />
	<TextArea label="Catatan (opsional)" name="notes" value={values.notes} rows={3} maxlength={LIMITS.notes} error={errors.notes} />

	<div class="grid gap-5 sm:grid-cols-3">
		<Field label="Durasi (opsional)" name="duration" value={values.duration} required={false} maxlength={LIMITS.duration} error={errors.duration} placeholder="mis. 2-3 Jam" />
		<Field
			label="Harga per orang (Rp)"
			name="price"
			value={values.price}
			required={false}
			inputmode="numeric"
			autocomplete="off"
			placeholder="mis. 250000"
			error={errors.price}
			hint="Angka bulat, mis. 250000 atau 250.000. Kosongkan bila belum ditentukan (tampil &quot;Harga menyusul&quot;)."
		/>
		<Field
			label="Minimal peserta"
			name="min_pax"
			value={values.min_pax}
			required={false}
			inputmode="numeric"
			autocomplete="off"
			placeholder="1"
			error={errors.min_pax}
			hint="Kosongkan = 1."
		/>
	</div>

	<div class="grid gap-5 sm:grid-cols-3">
		<label class="grid gap-1.5 text-[11px] font-bold tracking-wide" for="{uid}-mode">
			Cara hitung
			<select
				id="{uid}-mode"
				name="pricing_mode"
				class="rounded-md border border-line bg-white px-3 py-2.5 text-xs font-normal"
			>
				<option value="per_person" selected={values.pricing_mode !== 'per_unit'}>Per orang</option>
				<option value="per_unit" selected={values.pricing_mode === 'per_unit'}>Per satuan</option>
			</select>
			<span class="text-[11px] font-normal tracking-normal text-muted">Per satuan membulatkan peserta ke atas, lalu menagih satuan penuh.</span>
			{#if errors.pricing_mode}<span role="alert" class="font-semibold text-danger">{errors.pricing_mode}</span>{/if}
		</label>
		<Field
			label="Kapasitas per satuan"
			name="kapasitas_per_unit"
			value={values.kapasitas_per_unit}
			required={false}
			inputmode="numeric"
			autocomplete="off"
			placeholder="7"
			error={errors.kapasitas_per_unit}
			hint="Wajib bila per satuan. Offroad: 7 orang per mobil."
		/>
		<Field
			label="Nama satuan"
			name="nama_unit"
			value={values.nama_unit}
			required={false}
			maxlength={40}
			autocomplete="off"
			placeholder="mobil"
			error={errors.nama_unit}
			hint="Wajib bila per satuan. Tampil di rincian, misalnya mobil."
		/>
	</div>

	<fieldset class="m-0 grid min-w-0 gap-4 rounded-lg border border-line p-4">
		<legend class="px-1 text-[11px] font-bold tracking-wide">Foto</legend>
		{#if image}
			<div class="flex items-center gap-4">
				<img src={safeImage(image)} alt="Foto saat ini" width="160" height="117" class="h-[72px] w-24 rounded-md border border-line bg-cream object-cover" />
				<label class="flex cursor-pointer items-center gap-2 text-xs font-semibold">
					<input type="checkbox" name="remove_photo" value="1" class="size-4 accent-green-900" /> Hapus foto ini
				</label>
			</div>
		{/if}
		<div>
			<label for="{uid}-photo" class="mb-1.5 block text-[11px] font-bold tracking-wide">{image ? 'Ganti foto (opsional)' : 'Unggah foto (opsional)'}</label>
			<input
				id="{uid}-photo"
				type="file"
				name="photo"
				accept="image/jpeg,image/png,image/webp,image/avif"
				onchange={checkFile}
				aria-invalid={shownPhotoError ? true : undefined}
				aria-describedby="{uid}-photo-hint{shownPhotoError ? ` ${photoErrId}` : ''}"
				class="block w-full text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-cream file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-900"
			/>
			<p id="{uid}-photo-hint" class="mt-1.5 text-[11px] text-muted">
				JPEG, PNG, WebP, atau AVIF, maksimal 4 MB (ideal sekitar 1600 px lebar). Foto dari ponsel dapat memuat data
				lokasi; ekspor ulang tanpa lokasi bila perlu. Setelah ada kesalahan, pilih foto lagi.
			</p>
			{#if shownPhotoError}<p id={photoErrId} role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{shownPhotoError}</p>{/if}
		</div>
		<Field label="Teks alternatif foto (opsional)" name="image_alt" value={values.image_alt} required={false} maxlength={LIMITS.imageAlt} error={errors.image_alt} hint="Dibacakan pembaca layar. Bila kosong, nama paket yang dipakai." />
	</fieldset>

	{#if isNew}
		<p class="rounded-md bg-cream px-3 py-2.5 text-xs leading-[1.7]">
			Paket baru disimpan sebagai <strong>draft</strong> (belum tampil di situs). Terbitkan dari daftar paket setelah siap.
		</p>
	{:else}
		<label class="flex cursor-pointer items-center gap-2.5 text-xs font-semibold">
			<input type="checkbox" name="published" value="1" checked={values.published} class="size-4 accent-green-900" />
			Tampilkan di situs
		</label>
	{/if}

	<div class="flex flex-wrap gap-3">
		<Button type="submit" variant="accent">{submitLabel}</Button>
		<Button variant="outline" href="/admin/paket">Batal</Button>
	</div>
</form>
