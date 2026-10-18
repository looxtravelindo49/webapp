<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import TextArea from '#lib/components/admin/TextArea.svelte';
	import { LIMITS, type ArticleErrors, type ArticleRaw } from '#lib/article-form.js';
	import { coverImage } from '#lib/images.js';
	import UnsplashPicker from '#lib/components/admin/UnsplashPicker.svelte';

	/** Batas dan jenis yang diterima di sisi klien (server tetap menjadi penentu). */
	const MAX_BYTES = 4 * 1024 * 1024;
	const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

	let {
		values,
		errors = {},
		photoError = '',
		cover = null,
		credit = null,
		unsplashEnabled = false,
		submitLabel,
		isNew = false
	}: {
		values: ArticleRaw;
		errors?: ArticleErrors;
		/** Kesalahan dari server untuk isian foto. */
		photoError?: string;
		/** Path sampul tersimpan (halaman ubah). */
		cover?: string | null;
		/** Kredit bila sampul tersimpan berasal dari Unsplash. */
		credit?: { name: string; url: string | null } | null;
		/** Pemilih foto Unsplash tersedia (kunci API diatur). */
		unsplashEnabled?: boolean;
		submitLabel: string;
		isNew?: boolean;
	} = $props();

	const uid = $props.id();
	let clientPhotoError = $state('');
	let picked = $state<{ id: string; thumb: string; alt: string; width: number; height: number; user: { name: string; url: string | null } } | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();
	const shownPhotoError = $derived(clientPhotoError || photoError);
	const photoErrId = $derived(`${uid}-photo-error`);

	function checkFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		clientPhotoError = '';
		if (!file) return;
		picked = null; // satu sampul saja: memilih berkas membatalkan pilihan Unsplash
		if (!ACCEPT.includes(file.type)) clientPhotoError = 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.';
		else if (file.size > MAX_BYTES) clientPhotoError = 'Foto terlalu besar. Maksimal 4 MB.';
		if (clientPhotoError) e.currentTarget.value = ''; // batalkan pilihan agar tidak terkirim
	}
</script>

<form method="POST" enctype="multipart/form-data" class="grid gap-5 rounded-xl border border-line bg-white p-5 sm:p-7">
	<Field label="Judul" name="title" value={values.title} maxlength={LIMITS.title} error={errors.title} autocomplete="off" />
	<Field label="Kategori" name="category" value={values.category} maxlength={LIMITS.category} error={errors.category} autocomplete="off" placeholder="mis. PERENCANAAN" hint="Label singkat di atas judul; ditampilkan dengan huruf kapital." />
	<TextArea label="Ringkasan" name="excerpt" value={values.excerpt} rows={2} maxlength={LIMITS.excerpt} required error={errors.excerpt} hint="Satu atau dua kalimat untuk kartu artikel dan deskripsi di mesin pencari (maks. 300 karakter)." />
	<TextArea
		label="Isi artikel"
		name="body"
		value={values.body}
		rows={16}
		maxlength={LIMITS.body}
		error={errors.body}
		hint="Markdown sederhana: pisahkan paragraf dengan satu baris kosong; ## Subjudul; - butir daftar; 1. daftar bernomor; > kutipan; **tebal**; *miring*; [teks](https://alamat). HTML, gambar, kode, dan tabel tidak ditampilkan."
	/>

	<fieldset class="m-0 grid min-w-0 gap-4 rounded-lg border border-line p-4">
		<legend class="px-1 text-[11px] font-bold tracking-wide">Foto sampul</legend>
		{#if cover}
			<div class="flex items-center gap-4">
				<img src={coverImage(cover, { w: 160, h: 117 })} alt="Sampul saat ini" width="160" height="117" class="h-[72px] w-24 rounded-md border border-line bg-cream object-cover" />
				{#if credit}<p class="text-[11px] text-muted">Foto Unsplash oleh {credit.name}.</p>{/if}
				<label class="flex cursor-pointer items-center gap-2 text-xs font-semibold">
					<input type="checkbox" name="remove_photo" value="1" class="size-4 accent-green-900" /> Hapus foto ini
				</label>
			</div>
		{/if}
		{#if unsplashEnabled}
			<UnsplashPicker bind:picked onpick={() => { if (fileInput) fileInput.value = ''; clientPhotoError = ''; }} />
			<p class="text-[11px] text-muted">atau unggah foto sendiri:</p>
		{/if}
		<div>
			<label for="{uid}-photo" class="mb-1.5 block text-[11px] font-bold tracking-wide">{cover ? 'Ganti foto (opsional)' : 'Unggah foto (opsional)'}</label>
			<input
				id="{uid}-photo"
				type="file"
				name="photo"
				bind:this={fileInput}
				accept="image/jpeg,image/png,image/webp,image/avif"
				onchange={checkFile}
				aria-invalid={shownPhotoError ? true : undefined}
				aria-describedby="{uid}-photo-hint{shownPhotoError ? ` ${photoErrId}` : ''}"
				class="block w-full text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-cream file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-900"
			/>
			<p id="{uid}-photo-hint" class="mt-1.5 text-[11px] text-muted">
				JPEG, PNG, WebP, atau AVIF, maksimal 4 MB (ideal sekitar 1600 px lebar). Tanpa foto, situs memakai gambar bawaan. Setelah ada kesalahan, pilih foto lagi.
			</p>
			{#if shownPhotoError}<p id={photoErrId} role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{shownPhotoError}</p>{/if}
		</div>
		<Field label="Teks alternatif foto (opsional)" name="cover_alt" value={values.cover_alt} required={false} maxlength={LIMITS.coverAlt} error={errors.cover_alt} hint="Dibacakan pembaca layar. Bila kosong, judul artikel yang dipakai." />
	</fieldset>

	{#if isNew}
		<p class="rounded-md bg-cream px-3 py-2.5 text-xs leading-[1.7]">
			Artikel baru disimpan sebagai <strong>draf</strong> (belum tampil di situs). Terbitkan dan tandai sebagai populer setelah siap.
		</p>
	{:else}
		<div class="grid gap-3">
			<label class="flex cursor-pointer items-center gap-2.5 text-xs font-semibold">
				<input type="checkbox" name="published" value="1" checked={values.published} class="size-4 accent-green-900" />
				Tampilkan di situs
			</label>
			<label class="flex cursor-pointer items-center gap-2.5 text-xs font-semibold">
				<input type="checkbox" name="featured" value="1" checked={values.featured} class="size-4 accent-green-900" />
				Artikel populer (diutamakan di beranda)
			</label>
		</div>
	{/if}

	<div class="flex flex-wrap gap-3">
		<Button type="submit" variant="accent">{submitLabel}</Button>
		<Button variant="outline" href="/admin/artikel">Batal</Button>
	</div>
</form>
