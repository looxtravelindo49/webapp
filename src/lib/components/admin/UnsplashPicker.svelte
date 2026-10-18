<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Button from '#lib/components/Button.svelte';
	import Dialog from '#lib/components/Dialog.svelte';

	type Photo = { id: string; thumb: string; alt: string; width: number; height: number; user: { name: string; url: string | null } };
	type SearchPage = { total: number; totalPages: number; page: number; results: Photo[] };

	let {
		picked = $bindable<Photo | null>(null),
		onpick
	}: {
		/** Foto yang dipilih (berlaku setelah artikel disimpan). */
		picked?: Photo | null;
		/** Dipanggil saat foto dipilih, mis. untuk mengosongkan isian berkas. */
		onpick?: (photo: Photo) => void;
	} = $props();

	const MESSAGES: Record<string, string> = {
		'rate-limited': 'Jatah pencarian Unsplash sedang habis. Coba lagi nanti atau unggah foto sendiri.',
		unavailable: 'Unsplash tidak dapat dihubungi. Coba lagi nanti atau unggah foto sendiri.',
		invalid: 'Ketik minimal 2 karakter untuk mencari.',
		'not-configured': 'Pemilih foto Unsplash belum diaktifkan.'
	};
	const GENERIC = 'Pencarian gagal. Coba lagi atau unggah foto sendiri.';
	const SESSION = 'Sesi berakhir. Muat ulang halaman dan masuk lagi.';

	const uid = $props.id();
	let ready = $state(false);
	let open = $state(false);
	let query = $state('');
	let results = $state<Photo[]>([]);
	let page = $state(0);
	let totalPages = $state(0);
	let status = $state<'idle' | 'loading' | 'done' | 'error'>('idle');
	let error = $state('');
	let input: HTMLInputElement | undefined = $state();
	let searched = $state(''); // kueri yang hasilnya sedang ditampilkan
	let seq = 0; // mengabaikan respons basi

	onMount(() => (ready = true));

	async function load(q: string, p: number) {
		const mine = ++seq;
		status = 'loading';
		error = '';
		try {
			const res = await fetch(`/admin/artikel/unsplash?${new URLSearchParams({ q, page: String(p) })}`, { headers: { accept: 'application/json' } });
			if (!(res.headers.get('content-type') ?? '').includes('application/json')) throw new Error(SESSION);
			const body = await res.json();
			if (mine !== seq) return;
			if (!res.ok) throw new Error(MESSAGES[body?.error] ?? GENERIC);
			const data = body as SearchPage;
			results = p === 1 ? data.results : [...results, ...data.results];
			page = data.page;
			totalPages = data.totalPages;
			searched = q;
			status = 'done';
		} catch (err) {
			if (mine !== seq) return;
			error = err instanceof Error && err.message !== 'Failed to fetch' ? err.message : GENERIC;
			status = 'error';
		}
	}

	function search() {
		const q = query.trim();
		if (q.length < 2) {
			error = MESSAGES.invalid;
			status = 'error';
			return;
		}
		results = [];
		void load(q, 1);
	}

	// Enter di kolom cari tidak boleh mengirim formulir artikel yang membungkus dialog ini.
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			search();
		}
	}

	function choose(photo: Photo) {
		picked = photo;
		onpick?.(photo);
		open = false;
	}

	async function show() {
		open = true;
		await tick();
		input?.focus();
	}
</script>

<div class="grid gap-3">
	<div class="flex flex-wrap items-center gap-3">
		<Button type="button" variant="outline" class="!px-4 !py-2" disabled={!ready} onclick={show} aria-haspopup="dialog">Cari di Unsplash</Button>
		{#if picked}
			<Button type="button" variant="outline" class="!px-4 !py-2" onclick={() => (picked = null)}>Batalkan pilihan</Button>
		{/if}
	</div>
	<noscript><p class="text-[11px] text-muted">Pencarian Unsplash membutuhkan JavaScript. Foto sendiri tetap bisa diunggah.</p></noscript>

	<input type="hidden" name="unsplash_id" value={picked?.id ?? ''} />

	{#if picked}
		<div class="flex items-center gap-4" data-testid="unsplash-picked">
			<img src={picked.thumb} alt="Pratinjau foto Unsplash terpilih" width="160" height="117" class="h-[72px] w-24 rounded-md border border-line bg-cream object-cover" />
			<p class="text-xs">
				<strong class="block">Foto Unsplash terpilih</strong>
				<span class="text-muted">Foto oleh {picked.user.name} di Unsplash. Berlaku setelah artikel disimpan.</span>
			</p>
		</div>
	{/if}
</div>

<Dialog bind:open title="Cari foto di Unsplash" label="FOTO SAMPUL">
	<div class="grid gap-4">
		<div class="flex gap-2">
			<div class="grow">
				<label for="{uid}-q" class="mb-1.5 block text-[11px] font-bold tracking-wide">Kata kunci (bahasa Inggris memberi hasil terbaik)</label>
				<input
					id="{uid}-q"
					bind:this={input}
					bind:value={query}
					{onkeydown}
					type="text"
					enterkeyhint="search"
					maxlength="80"
					autocomplete="off"
					placeholder="mis. forest camp"
					class="w-full rounded-md border border-line bg-white px-3 py-2.5 text-xs text-green-900"
				/>
			</div>
			<Button type="button" class="mt-5.5 !px-4 !py-2" onclick={search} disabled={status === 'loading'}>Cari</Button>
		</div>

		<div role="status" aria-live="polite" class="min-h-5 text-xs">
			{#if status === 'loading' && results.length === 0}
				<p class="text-muted">Mencari…</p>
			{:else if status === 'error'}
				<p role="alert" class="font-semibold text-danger">{error}</p>
			{:else if status === 'done' && results.length === 0}
				<p class="text-muted">Tidak ada foto yang cocok dengan "{searched}".</p>
			{/if}
		</div>

		{#if results.length > 0}
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each results as photo (photo.id)}
					<li>
						<button
							type="button"
							onclick={() => choose(photo)}
							aria-label="Pilih foto {photo.alt || 'tanpa deskripsi'}, oleh {photo.user.name}"
							class="group block w-full cursor-pointer overflow-hidden rounded-md border border-line bg-cream p-0 text-left"
						>
							<img src={photo.thumb} alt="" loading="lazy" width="400" height="267" class="aspect-3/2 w-full object-cover transition-opacity group-hover:opacity-90" />
							<span class="block truncate px-2 py-1.5 text-[10px] font-semibold">{photo.user.name}</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if page < totalPages}
				<div>
					<Button type="button" variant="outline" class="!px-4 !py-2" disabled={status === 'loading'} onclick={() => load(searched, page + 1)}>
						{status === 'loading' ? 'Memuat…' : 'Muat lebih banyak'}
					</Button>
				</div>
			{/if}
			<p class="text-[10px] text-muted">Foto dari Unsplash. Kreditnya akan tampil otomatis di halaman artikel.</p>
		{/if}
	</div>
</Dialog>
