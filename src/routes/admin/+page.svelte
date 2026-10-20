<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const cards = [
		{ href: '/admin/leads', title: 'Leads', text: 'Estimasi yang dikirim pengunjung lewat kalkulator: nama, WhatsApp, paket, dan nomor invoice.' },
		{ href: '/admin/paket', title: 'Paket', text: 'Tambah, ubah, urutkan, terbitkan atau sembunyikan paket, harga, dan foto.' },
		{ href: '/admin/artikel', title: 'Artikel', text: 'Tulis, terbitkan, dan tandai artikel populer yang tampil di beranda dan halaman artikel.' },
		{ href: '/admin/pengaturan', title: 'Pengaturan', text: 'Nomor WhatsApp tujuan konsultasi dan hasil kalkulator.' },
		{ href: '/admin/akun', title: 'Akun', text: 'Buat akun admin baru, reset password, atau hapus akun.' },
		{ href: '/admin/ganti-password', title: 'Ganti password', text: 'Ubah password akunmu sendiri.' }
	];
</script>

<svelte:head><title>Admin | Lembang Adventures</title></svelte:head>

<h1 class="text-2xl font-black tracking-tight">Admin</h1>
<p class="mt-2 max-w-xl text-xs leading-[1.8] text-muted">Selamat datang. Pilih bagian yang ingin dikelola.</p>

{#if data.withoutPrice > 0}
	<p role="status" class="mt-5 max-w-2xl rounded-md border border-accent-700 bg-white px-4 py-3 text-xs font-semibold" data-testid="price-warning">
		{data.withoutPrice} paket terbit belum berharga; kalkulator menampilkan "Harga menyusul" untuknya.
		<a href="/admin/paket" class="underline">Isi harga di Kelola paket</a>
	</p>
{/if}

<ul class="mt-6 grid gap-3 sm:grid-cols-2">
	{#each cards as c (c.href)}
		<li>
			<a href={c.href} class="block rounded-xl border border-line bg-white p-5 hover:bg-white/60">
				<strong class="block text-sm">{c.title}</strong>
				<span class="text-xs text-muted">{c.text}</span>
			</a>
		</li>
	{/each}
</ul>
