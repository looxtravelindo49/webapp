<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import TextArea from '#lib/components/admin/TextArea.svelte';
	import { safeImage } from '#lib/images.js';
	import { PROMO_LIMITS, type Promo, type PromoErrors } from '#lib/promo.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const waFailed = $derived(form && 'error' in form && !('promo' in form) ? form : null);
	const promoFailed = $derived(form && 'promo' in form && 'errors' in form ? form : null);
	const promo = $derived((promoFailed ? promoFailed.values : data.promo) as Promo);
	const promoErrors = $derived((promoFailed?.errors ?? {}) as PromoErrors);

	const MAX_BYTES = 4 * 1024 * 1024;
	const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
	let clientPhotoError = $state('');

	function checkFile(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		clientPhotoError = '';
		if (!file) return;
		if (!ACCEPT.includes(file.type)) clientPhotoError = 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.';
		else if (file.size > MAX_BYTES) clientPhotoError = 'Foto terlalu besar. Maksimal 4 MB.';
		if (clientPhotoError) e.currentTarget.value = '';
	}
</script>

<svelte:head><title>Pengaturan | Admin Lembang Adventure</title></svelte:head>

<h1 class="text-2xl font-black tracking-tight">Pengaturan</h1>
<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">Perubahan langsung dipakai di situs publik tanpa perlu build ulang.</p>

{#if form && 'ok' in form && form.ok}
	<p role="status" class="mt-5 max-w-lg rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">{form.notice}</p>
{/if}

<section class="mt-6" aria-labelledby="wa">
	<h2 id="wa" class="mb-3 text-sm font-extrabold tracking-wide uppercase">WhatsApp</h2>
	<form method="POST" class="grid max-w-lg gap-5 rounded-xl border border-line bg-white p-6 sm:p-7">
		<Field
			label="Nomor WhatsApp tujuan"
			name="whatsapp"
			value={waFailed ? waFailed.whatsapp : data.whatsapp}
			required={false}
			inputmode="tel"
			autocomplete="off"
			placeholder="0812-3456-7890"
			hint="Boleh format lokal (0812-…) atau internasional (+62 812 …); disimpan sebagai 62812…. Kosongkan untuk menyembunyikan tombol WhatsApp di kalkulator."
			error={waFailed?.error}
		/>
		<Button type="submit" variant="accent">Simpan</Button>
	</form>
</section>

<section class="mt-10" aria-labelledby="promo-judul">
	<h2 id="promo-judul" class="mb-3 text-sm font-extrabold tracking-wide uppercase">Popup promo</h2>
	<p class="mb-4 max-w-2xl text-xs leading-[1.8] text-muted">
		Muncul sekitar 1,5 detik setelah beranda dimuat, sekali tiap versi isi. Menutupnya disimpan di peramban pengunjung.
		Mengubah label, judul, nominal, syarat, waktu berakhir, tombol, atau foto membuatnya tampil lagi. Popup hilang sendiri setelah waktu berakhir (WIB).
	</p>
	<form method="POST" action="?/promo" enctype="multipart/form-data" class="grid max-w-lg gap-5 rounded-xl border border-line bg-white p-6 sm:p-7">
		<input type="hidden" name="current_image" value={promo.image} />
		<label class="flex cursor-pointer items-center gap-2.5 text-xs font-semibold">
			<input type="checkbox" name="enabled" value="1" checked={promo.enabled} class="size-4 accent-green-900" />
			Tampilkan popup
		</label>
		<Field label="Label" name="label" value={promo.label} maxlength={PROMO_LIMITS.label} autocomplete="off" error={promoErrors.label} hint="Pil kecil di atas judul, misalnya Promo Oktober." />
		<Field label="Judul" name="title" value={promo.title} maxlength={PROMO_LIMITS.title} autocomplete="off" error={promoErrors.title} hint="Tampil sebelum nominal, misalnya Diskon up to." />
		<Field label="Nominal" name="amount" value={promo.amount} maxlength={PROMO_LIMITS.amount} autocomplete="off" error={promoErrors.amount} hint="Teks, misalnya Rp500.000. Bukan angka hitungan." />
		<TextArea
			label="Syarat"
			name="conditions"
			value={promo.conditions}
			rows={5}
			maxlength={PROMO_LIMITS.conditions}
			required
			error={promoErrors.conditions}
			hint="Kalimat syarat di paragraf pertama. Baris yang diawali angka dan titik (1. …) tampil sebagai daftar langkah."
		/>
		<div>
			<label for="promo-ends" class="mb-1.5 block text-[11px] font-bold tracking-wide">Berakhir (WIB)</label>
			<input
				id="promo-ends"
				type="datetime-local"
				name="ends_at"
				value={promo.endsAt}
				required
				aria-invalid={promoErrors.endsAt ? true : undefined}
				aria-describedby="promo-ends-hint{promoErrors.endsAt ? ' promo-ends-error' : ''}"
				class="w-full rounded-md border bg-white px-3 py-2.5 text-xs text-green-900 {promoErrors.endsAt ? 'border-danger' : 'border-line'}"
			/>
			<p id="promo-ends-hint" class="mt-1.5 text-[11px] text-muted">Popup tidak muncul lagi mulai waktu ini. 1 Nov 2026 00:00 berarti berlaku sampai akhir 31 Oktober.</p>
			{#if promoErrors.endsAt}<p id="promo-ends-error" role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{promoErrors.endsAt}</p>{/if}
		</div>
		<Field label="Teks tombol form" name="cta" value={promo.cta} maxlength={PROMO_LIMITS.cta} autocomplete="off" error={promoErrors.cta} hint="Menuju bagian kalkulator di beranda. Tombol WhatsApp tetap &quot;Chat WhatsApp&quot;." />
		<fieldset class="m-0 grid min-w-0 gap-3 rounded-lg border border-line p-4">
			<legend class="px-1 text-[11px] font-bold tracking-wide">Foto</legend>
			<img src={safeImage(promo.image)} alt="" width="160" height="120" class="h-[72px] w-24 rounded-md border border-line bg-cream object-cover" />
			<div>
				<label for="promo-photo" class="mb-1.5 block text-[11px] font-bold tracking-wide">Ganti foto (opsional)</label>
				<input
					id="promo-photo"
					type="file"
					name="photo"
					accept="image/jpeg,image/png,image/webp,image/avif"
					onchange={checkFile}
					aria-invalid={promoErrors.image || clientPhotoError ? true : undefined}
					class="block w-full text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-cream file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-900"
				/>
				<p class="mt-1.5 text-[11px] text-muted">JPEG, PNG, WebP, atau AVIF, maksimal 4 MB. Disimpan sebagai WebP.</p>
				{#if clientPhotoError || promoErrors.image}
					<p role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{clientPhotoError || promoErrors.image}</p>
				{/if}
			</div>
			<Field
				label="Teks alternatif foto"
				name="image_alt"
				value={promo.imageAlt}
				required={false}
				maxlength={PROMO_LIMITS.imageAlt}
				autocomplete="off"
				error={promoErrors.imageAlt}
				hint="Dibacakan pembaca layar."
			/>
		</fieldset>
		<Button type="submit" variant="accent">Terapkan promo</Button>
	</form>
</section>
