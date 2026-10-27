<script lang="ts">
	import Button from '#lib/components/Button.svelte';

	type Mode = '' | 'jam' | 'hari' | 'waktu';

	let {
		label,
		expired,
		error = '',
		notice = ''
	}: {
		label: string | null;
		expired: boolean;
		error?: string;
		notice?: string;
	} = $props();

	let mode = $state<Mode>('');
	let nilai = $state('');

	function choose(next: Mode) {
		if (next !== mode) nilai = '';
		mode = next;
	}

	const field = 'w-full rounded-md border border-line px-3 py-2.5 text-xs font-normal';
</script>

<form method="POST" action="?/berlaku" class="mt-5 grid max-w-xl gap-3 rounded-xl border border-line bg-white p-5">
	<fieldset class="grid gap-3">
		<legend class="text-[10px] font-bold tracking-wide uppercase">Masa berlaku</legend>
		<p class="text-[11px] leading-[1.7] text-muted">
			Isi jam, hari, atau tanggal setiap kali. Tidak ada durasi bawaan. Kosong berarti halaman publik tidak menampilkan penghitung waktu.
		</p>
		{#if label}
			<p class="text-xs font-semibold">
				Berlaku hingga {label}
				{#if expired}<span class="text-danger"> · sudah lewat</span>{/if}
			</p>
		{:else}
			<p class="text-xs font-semibold">Belum diatur.</p>
		{/if}
		<div class="flex flex-wrap gap-4 text-[11px] font-semibold">
			<label class="flex items-center gap-2">
				<input type="radio" name="masa_mode" value="jam" checked={mode === 'jam'} onclick={() => choose('jam')} />
				Jam
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" name="masa_mode" value="hari" checked={mode === 'hari'} onclick={() => choose('hari')} />
				Hari
			</label>
			<label class="flex items-center gap-2">
				<input type="radio" name="masa_mode" value="waktu" checked={mode === 'waktu'} onclick={() => choose('waktu')} />
				Tanggal &amp; waktu
			</label>
		</div>
		{#if mode === 'jam' || mode === 'hari'}
			<label class="grid max-w-xs gap-1 text-[11px] font-semibold" for="masa_nilai">
				Jumlah {mode === 'jam' ? 'jam' : 'hari'}
				<input id="masa_nilai" name="masa_nilai" inputmode="numeric" autocomplete="off" bind:value={nilai} class={field} />
			</label>
		{:else if mode === 'waktu'}
			<label class="grid max-w-xs gap-1 text-[11px] font-semibold" for="masa_nilai">
				Tanggal dan waktu (WIB)
				<input id="masa_nilai" name="masa_nilai" type="datetime-local" bind:value={nilai} class={field} />
			</label>
		{/if}
		{#if error}<p role="alert" class="text-[11px] font-semibold text-danger">{error}</p>{/if}
		{#if notice}<p role="status" class="text-[11px] font-semibold">{notice}</p>{/if}
		<div class="flex flex-wrap gap-2">
			<Button type="submit" name="masa_aksi" value="terapkan" variant="primary">Terapkan</Button>
			<Button type="submit" name="masa_aksi" value="perpanjang" variant="outline" disabled={mode === 'waktu' || mode === ''}>Perpanjang</Button>
			<Button type="submit" name="masa_aksi" value="reset" variant="outline">Hapus masa berlaku</Button>
		</div>
		<p class="text-[11px] leading-[1.7] text-muted">Perpanjang menambah jam atau hari ke batas yang masih berjalan. Hapus menghilangkan penghitung waktu.</p>
	</fieldset>
</form>
