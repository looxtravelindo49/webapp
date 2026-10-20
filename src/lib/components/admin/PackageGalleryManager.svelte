<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import { safeImage } from '#lib/images.js';
	import { LIMITS } from '#lib/package-form.js';

	const MAX_BYTES = 4 * 1024 * 1024;
	const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
	const GALLERY_LIMIT = 4;

	let {
		photos,
		error = ''
	}: {
		photos: { id: number; path: string; alt: string | null }[];
		error?: string;
	} = $props();

	const uid = $props.id();
	let clientError = $state('');
	const shownError = $derived(clientError || error);
	const full = $derived(photos.length >= GALLERY_LIMIT);

	function checkFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		clientError = '';
		if (!file) return;
		if (!ACCEPT.includes(file.type)) clientError = 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.';
		else if (file.size > MAX_BYTES) clientError = 'Foto terlalu besar. Maksimal 4 MB.';
		if (clientError) e.currentTarget.value = '';
	}
</script>

<section class="mt-8 grid gap-4 rounded-xl border border-line bg-white p-5 sm:p-7" aria-labelledby="{uid}-judul">
	<div>
		<h2 id="{uid}-judul" class="text-sm font-black tracking-tight">Galeri foto</h2>
		<p class="mt-1.5 text-[11px] leading-[1.7] text-muted">
			Maksimal 4 foto. Foto pertama tampil di kartu katalog dan sebagai foto besar di halaman paket. Jenis dan ukuran sama dengan foto utama.
		</p>
	</div>

	{#if shownError}
		<p role="alert" class="rounded-md border border-danger bg-white px-3 py-2 text-[11px] font-semibold text-danger">{shownError}</p>
	{/if}

	{#if full}
		<p class="rounded-md bg-cream px-3 py-2.5 text-xs">Galeri penuh (4 foto). Hapus satu foto untuk menambah yang baru.</p>
	{:else}
		<form method="POST" action="?/unggah" enctype="multipart/form-data" class="grid gap-4 rounded-lg border border-line p-4">
			<div>
				<label for="{uid}-file" class="mb-1.5 block text-[11px] font-bold tracking-wide">Tambah foto galeri</label>
				<input
					id="{uid}-file"
					type="file"
					name="gallery_photo"
					accept="image/jpeg,image/png,image/webp,image/avif"
					required
					onchange={checkFile}
					aria-describedby="{uid}-file-hint"
					class="block w-full text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-cream file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-900"
				/>
				<p id="{uid}-file-hint" class="mt-1.5 text-[11px] text-muted">JPEG, PNG, WebP, atau AVIF, maksimal 4 MB.</p>
			</div>
			<Field
				label="Teks alternatif foto galeri"
				name="gallery_alt"
				required={false}
				maxlength={LIMITS.imageAlt}
				autocomplete="off"
				hint="Opsional. Dibacakan pembaca layar. Bila kosong, teks alternatif foto utama atau nama paket yang dipakai."
			/>
			<div>
				<Button type="submit" variant="accent">Unggah ke galeri</Button>
			</div>
		</form>
	{/if}

	{#if photos.length > 0}
		<ol class="grid gap-4">
			{#each photos as photo, i (photo.id)}
				<li class="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[7rem_1fr] sm:items-start">
					<img
						src={safeImage(photo.path)}
						alt={photo.alt || `Foto galeri ${i + 1}`}
						width="160"
						height="120"
						class="aspect-[4/3] w-full rounded-md border border-line bg-cream object-cover sm:w-28"
					/>
					<div class="grid min-w-0 gap-3">
						<form method="POST" action="?/teks" class="grid gap-3">
							<input type="hidden" name="photo_id" value={photo.id} />
							<Field
								label="Teks alternatif foto {i + 1}"
								name="gallery_alt"
								value={photo.alt ?? ''}
								required={false}
								maxlength={LIMITS.imageAlt}
								autocomplete="off"
							/>
							<div>
								<Button type="submit" variant="outline" class="!px-4 !py-2">Simpan teks alternatif</Button>
							</div>
						</form>
						<div class="flex flex-wrap gap-2">
							<form method="POST" action="?/naik">
								<input type="hidden" name="photo_id" value={photo.id} />
								<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === 0}>Naik</Button>
							</form>
							<form method="POST" action="?/turun">
								<input type="hidden" name="photo_id" value={photo.id} />
								<Button type="submit" variant="outline" class="!px-3 !py-2" disabled={i === photos.length - 1}>Turun</Button>
							</form>
							<form method="POST" action="?/hapusGaleri">
								<input type="hidden" name="photo_id" value={photo.id} />
								<Button type="submit" variant="danger" class="!px-4 !py-2">Hapus dari galeri</Button>
							</form>
						</div>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</section>
