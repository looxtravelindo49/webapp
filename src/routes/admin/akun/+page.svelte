<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Field from '#lib/components/admin/Field.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' });
	const created = (iso: string) => date.format(new Date(iso));

	const buatForm = $derived(form?.action === 'buat' ? form : null);
	const buatErrors = $derived(buatForm && 'errors' in buatForm ? buatForm.errors : undefined);
	const rowError = (id: number) =>
		form && 'error' in form && (form.action === 'reset' || form.action === 'hapus') && form.id === id ? form.error : '';
</script>

<svelte:head><title>Kelola akun | Admin Lembang Adventures</title></svelte:head>

<h1 class="text-2xl font-black tracking-tight">Kelola akun</h1>
<p class="mt-2 max-w-2xl text-xs leading-[1.8] text-muted">
	Semua akun admin setara. Akun baru dan akun yang password-nya direset wajib menggantinya saat login berikutnya.
</p>

{#if form && 'ok' in form && form.ok}
	<p role="status" class="mt-5 rounded-md border border-green-900 bg-white px-4 py-3 text-xs font-semibold">
		{form.notice}
	</p>
{/if}

<section class="mt-6" aria-labelledby="daftar">
	<h2 id="daftar" class="mb-3 text-sm font-extrabold tracking-wide uppercase">Akun ({data.users.length})</h2>
	<ul class="divide-y divide-line rounded-xl border border-line bg-white">
		{#each data.users as u (u.id)}
			{@const isMe = u.id === data.currentId}
			<li class="grid gap-3 p-4 sm:p-5">
				<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div class="flex flex-wrap items-center gap-2">
						<strong class="text-sm break-all">{u.login}</strong>
						{#if isMe}<span class="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold">Anda</span>{/if}
						{#if u.mustChange}
							<span class="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold">Wajib ganti password</span>
						{/if}
					</div>
					<span class="text-[11px] text-muted">Dibuat {created(u.createdAt)}</span>
				</div>

				{#if isMe}
					<p class="text-[11px] text-muted">
						Ini akunmu. <a href="/admin/ganti-password" class="font-bold underline">Ganti password</a>
					</p>
				{:else}
					<div class="flex flex-wrap items-start gap-x-4 gap-y-3">
						<!-- Dibuka lagi bila reset baris ini gagal, supaya pesan kesalahan terlihat (halaman dimuat ulang dari server). -->
						<details class="min-w-0 flex-1 basis-64" open={form?.action === 'reset' && 'error' in form && form.id === u.id}>
							<summary class="cursor-pointer text-xs font-bold underline">Reset password</summary>
							<form method="POST" action="?/reset" class="mt-3 grid gap-3 sm:max-w-sm">
								<input type="hidden" name="id" value={u.id} />
								<Field label="Password sementara baru" name="password" type="password" autocomplete="new-password" minlength={8} maxlength={128} error={rowError(u.id) && form?.action === 'reset' ? rowError(u.id) : ''} />
								<Button type="submit" variant="outline">Reset password</Button>
							</form>
						</details>
						<form
							method="POST"
							action="?/hapus"
							onsubmit={(e) => {
								if (!confirm(`Hapus akun "${u.login}"? Tindakan ini tidak bisa dibatalkan.`)) {
									e.preventDefault();
									return;
								}
								// Server menolak penghapusan tanpa tanda ini (lihat action `hapus`).
								(e.currentTarget.elements.namedItem('confirm') as HTMLInputElement).value = 'yes';
							}}
						>
							<input type="hidden" name="id" value={u.id} />
							<input type="hidden" name="confirm" value="" />
							<Button type="submit" variant="danger" class="!px-4 !py-2">Hapus</Button>
						</form>
					</div>
					{#if rowError(u.id) && form?.action === 'hapus'}
						<p role="alert" class="text-[11px] font-semibold text-danger">{rowError(u.id)}</p>
					{/if}
				{/if}
			</li>
		{/each}
	</ul>
</section>

<section class="mt-10" aria-labelledby="baru">
	<h2 id="baru" class="mb-3 text-sm font-extrabold tracking-wide uppercase">Buat akun baru</h2>
	<form method="POST" action="?/buat" class="grid max-w-md gap-5 rounded-xl border border-line bg-white p-6 sm:p-7">
		<Field
			label="Login"
			name="login"
			value={buatForm?.login ?? ''}
			autocomplete="off"
			maxlength={64}
			hint="3–64 karakter: huruf, angka, dan @ . _ -"
			error={buatErrors?.login}
		/>
		<Field
			label="Password sementara"
			name="password"
			type="password"
			autocomplete="new-password"
			minlength={8}
			maxlength={128}
			hint="Minimal 8 karakter. Pemilik akun wajib menggantinya saat login pertama."
			error={buatErrors?.password}
		/>
		<Button type="submit" variant="accent">Buat akun</Button>
	</form>
</section>
