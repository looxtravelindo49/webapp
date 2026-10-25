<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import TextArea from '#lib/components/admin/TextArea.svelte';
	import { CLIENT_NAME_MAX, type ClientLogo } from '#lib/clients.js';
	import { safeImage } from '#lib/images.js';
	import { PROMO_LIMITS, type Promo, type PromoErrors } from '#lib/promo.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const waFailed = $derived(form && 'error' in form && !('promo' in form) && !('clients' in form) ? form : null);
	const clientsFailed = $derived(form && 'clients' in form && 'message' in form ? form : null);
	const clientRows = $derived((clientsFailed ? clientsFailed.values : data.clients) as ClientLogo[]);
	const clientMessage = $derived(clientsFailed ? String(clientsFailed.message) : '');
	const newClientName = $derived(clientsFailed && 'newName' in clientsFailed ? String(clientsFailed.newName) : '');
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

	let logoErrors = $state<Record<string, string>>({});

	function checkLogo(e: Event & { currentTarget: HTMLInputElement }) {
		const input = e.currentTarget;
		const file = input.files?.[0];
		const next = { ...logoErrors };
		delete next[input.id];
		if (file && !ACCEPT.includes(file.type)) next[input.id] = 'Jenis berkas tidak didukung. Pilih foto JPEG, PNG, WebP, atau AVIF.';
		else if (file && file.size > MAX_BYTES) next[input.id] = 'Foto terlalu besar. Maksimal 4 MB.';
		if (next[input.id]) input.value = '';
		logoErrors = next;
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
	<form method="POST" action="?/whatsapp" class="grid max-w-lg gap-5 rounded-xl border border-line bg-white p-6 sm:p-7">
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

<section class="mt-10" aria-labelledby="klien-admin">
	<h2 id="klien-admin" class="mb-3 text-sm font-extrabold tracking-wide uppercase">Logo klien</h2>
	<p class="mb-4 max-w-3xl text-xs leading-[1.8] text-muted">
		Nama dan logo di pita Our Clients pada beranda. Tanpa logo, nama tampil sebagai teks abu-abu. Urutan di sini sama dengan yang tampil di situs.
	</p>
	<form method="POST" action="?/clients" enctype="multipart/form-data" class="flex max-w-3xl flex-col gap-4 rounded-xl border border-line bg-white p-6 sm:p-7">
		{#if clientMessage}
			<p role="alert" class="rounded-md border border-danger bg-white px-4 py-3 text-xs font-semibold text-danger">{clientMessage}</p>
		{/if}
		<div class="order-last grid gap-3">
			<p class="text-[11px] leading-[1.7] text-muted">JPEG, PNG, WebP, atau AVIF, maksimal 4 MB. Disimpan sebagai WebP. Logo yang sudah terpasang tetap dipakai sampai diganti atau dihapus.</p>
			<Button type="submit" name="intent" value="save" variant="accent" class="w-fit">Simpan logo klien</Button>
		</div>
		{#if clientRows.length === 0}
			<p class="text-xs text-muted">Belum ada klien. Pita Our Clients disembunyikan di beranda sampai ada satu nama.</p>
		{/if}
		{#each clientRows as client, i (client.id)}
			<fieldset class="m-0 grid min-w-0 gap-3 rounded-lg border border-line p-4">
				<legend class="px-1 text-[11px] font-bold tracking-wide">Klien {i + 1}</legend>
				<input type="hidden" name="id" value={client.id} />
				<div class="flex h-16 w-28 items-center justify-center rounded-md border border-line bg-cream px-2">
					{#if client.src}
						<img src={client.src} alt="" class="max-h-10 max-w-full object-contain" style="filter: grayscale(1); opacity: 0.82" />
					{:else}
						<span class="text-center text-[11px] font-extrabold tracking-wide text-muted">{client.name}</span>
					{/if}
				</div>
				<p class="text-[11px] text-muted">{client.src ? 'Tampil abu-abu di pita, seperti di beranda.' : 'Tanpa logo, nama tampil abu-abu.'}</p>
				<Field label="Nama" name="name" value={client.name} required={false} maxlength={CLIENT_NAME_MAX} autocomplete="off" />
				<div class="min-w-0">
					<label for="logo-{client.id}" class="mb-1.5 block text-[11px] font-bold tracking-wide">Ganti logo</label>
					<input
						id="logo-{client.id}"
						type="file"
						name="logo_{client.id}"
						accept="image/jpeg,image/png,image/webp,image/avif"
						onchange={checkLogo}
						aria-invalid={logoErrors[`logo-${client.id}`] ? true : undefined}
						class="block w-full min-w-0 max-w-full text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-cream file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-900"
					/>
					{#if logoErrors[`logo-${client.id}`]}
						<p role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{logoErrors[`logo-${client.id}`]}</p>
					{/if}
				</div>
				{#if client.src}
					<label class="flex cursor-pointer items-center gap-2.5 text-xs font-semibold">
						<input type="checkbox" name="clear" value={client.id} class="size-4 accent-green-900" />
						Hapus logo
					</label>
				{/if}
				<div class="flex flex-wrap gap-2">
					<Button type="submit" name="intent" value="up:{client.id}" variant="outline" class="!px-3 !py-2" disabled={i === 0}>Naik</Button>
					<Button type="submit" name="intent" value="down:{client.id}" variant="outline" class="!px-3 !py-2" disabled={i === clientRows.length - 1}>Turun</Button>
					<Button type="submit" name="intent" value="delete:{client.id}" variant="danger" class="!px-3 !py-2">Hapus</Button>
				</div>
			</fieldset>
		{/each}
		<fieldset class="m-0 grid min-w-0 gap-3 rounded-lg border border-line p-4">
			<legend class="px-1 text-[11px] font-bold tracking-wide">Tambah klien</legend>
			<Field
				label="Nama klien baru"
				name="new_name"
				value={newClientName}
				required={false}
				maxlength={CLIENT_NAME_MAX}
				autocomplete="off"
				hint="Tombol Tambah yang menyimpan klien baru. Simpan logo klien hanya menulis perubahan pada daftar yang ada."
			/>
			<div class="min-w-0">
				<label for="new-logo" class="mb-1.5 block text-[11px] font-bold tracking-wide">Logo baru (opsional)</label>
				<input
					id="new-logo"
					type="file"
					name="new_logo"
					accept="image/jpeg,image/png,image/webp,image/avif"
					onchange={checkLogo}
					aria-invalid={logoErrors['new-logo'] ? true : undefined}
					class="block w-full min-w-0 max-w-full text-xs file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-cream file:px-3 file:py-2 file:text-xs file:font-bold file:text-green-900"
				/>
				<p class="mt-1.5 text-[11px] text-muted">Kosongkan untuk menampilkan nama abu-abu.</p>
				{#if logoErrors['new-logo']}
					<p role="alert" class="mt-1.5 text-[11px] font-semibold text-danger">{logoErrors['new-logo']}</p>
				{/if}
			</div>
			<Button type="submit" name="intent" value="add" variant="outline" class="w-fit !px-4 !py-2.5">Tambah</Button>
		</fieldset>
	</form>
</section>
