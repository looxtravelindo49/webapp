<script lang="ts">
	import { untrack } from 'svelte';
	import { DISCLAIMER, totalNote, totalText } from '#lib/estimate.js';
	import { formatRupiah } from '#lib/format.js';
	import { calculateEstimate, MAX_PAX, parsePax } from '#lib/pricing.js';
	import { getTripContext } from '#lib/trip.svelte.js';
	import type { Package } from '#lib/types.js';
	import { normalizeWhatsapp } from '#lib/whatsapp.js';
	import Button from './Button.svelte';

	let { packages, waNumber }: { packages: Package[]; waNumber: string | null } = $props();

	const trip = getTripContext();
	const uid = $props.id();

	const pax = $derived(parsePax(trip.pax));
	const estimate = $derived(calculateEstimate(packages, trip.selected, pax));
	const paxError = $derived(trip.pax.trim() !== '' && pax === null);

	const contact = $derived(normalizeWhatsapp(trip.whatsapp));
	const contactError = $derived(trip.whatsapp.trim() !== '' && contact === null);

	const missing = $derived(
		[
			trip.team.trim() === '' ? 'nama tim' : null,
			estimate.state === 'empty' ? 'minimal satu paket' : null,
			pax === null ? 'jumlah peserta yang valid' : null,
			contact === null ? 'nomor WhatsApp yang valid' : null
		].filter((m): m is string => m !== null)
	);
	const ready = $derived(missing.length === 0);

	type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'error'; message: string };
	let status = $state<Status>({ kind: 'idle' });

	// Hasil sebelumnya tidak lagi relevan setelah masukan berubah.
	$effect(() => {
		void [trip.team, trip.whatsapp, trip.pax, trip.date, trip.notes, trip.selected.length];
		untrack(() => {
			if (status.kind !== 'busy') status = { kind: 'idle' };
		});
	});

	async function sendWhatsapp() {
		if (!ready || !waNumber || status.kind === 'busy') return;
		status = { kind: 'busy' };
		// Jendela dibuka selagi izin klik masih ada. Isinya diisi setelah server menyimpan lead.
		const popup = window.open('about:blank', '_blank');
		try {
			const res = await fetch('/api/leads', {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({
					nama: trip.team,
					whatsapp: trip.whatsapp,
					paket: trip.selected,
					jumlahPeserta: trip.pax,
					tanggal: trip.date,
					catatan: trip.notes
				})
			});
			const data = (await res.json().catch(() => null)) as { waUrl?: string; invoicePath?: string; message?: string } | null;
			if (!res.ok || !data?.waUrl || !data.invoicePath) {
				popup?.close();
				status = {
					kind: 'error',
					message: data?.message || 'Estimasi belum tersimpan. WhatsApp tidak kami buka. Coba lagi, ya.'
				};
				return;
			}
			if (popup && !popup.closed) {
				try {
					popup.location.href = data.waUrl;
				} catch {
					popup.close();
				}
			}
			window.location.assign(data.invoicePath);
		} catch {
			popup?.close();
			status = { kind: 'error', message: 'Estimasi belum tersimpan. WhatsApp tidak kami buka. Coba lagi, ya.' };
		}
	}

	const label = 'mb-1.5 block text-[10px] font-bold tracking-wide';
	const field =
		'w-full rounded-md border border-line bg-white px-3 py-2.5 text-xs text-green-900 placeholder:text-muted/70';
</script>

<section id="konsultasi" tabindex="-1" class="on-dark bg-green-900 py-11 text-white outline-none sm:py-16">
	<div class="wrap">
		<div class="mb-7 max-w-xl sm:mb-9">
			<div class="eyebrow text-accent">HITUNG PERKIRAANNYA</div>
			<h2 class="my-3 text-[30px] leading-tight font-black tracking-tight sm:text-4xl">
				Konsultasikan <span class="text-accent">Tripmu.</span>
			</h2>
			<p class="text-xs leading-[1.9] text-green-100 sm:text-[13px]">
				{#if waNumber}
					Pilih satu atau beberapa paket, isi data tim, dan lihat estimasi biayanya. Kirim ke WhatsApp untuk menyimpan estimasi dan membuka invoice.
				{:else}
					Pilih satu atau beberapa paket, isi data tim, dan lihat estimasi biayanya.
				{/if}
			</p>
		</div>

		<div class="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
			<form class="on-light rounded-xl bg-white p-5 text-green-900 sm:p-7" onsubmit={(e) => e.preventDefault()} novalidate>
				<div class="grid gap-5">
					<div>
						<label for="{uid}-team" class={label}>Nama tim / perusahaan</label>
						<input
							id="{uid}-team"
							class={field}
							maxlength="100"
							autocomplete="organization"
							placeholder="Tim kamu"
							bind:value={trip.team}
						/>
					</div>

					<div>
						<label for="{uid}-wa" class={label}>Nomor WhatsApp</label>
						<input
							id="{uid}-wa"
							type="tel"
							class="{field} {contactError ? 'border-danger' : ''}"
							inputmode="tel"
							autocomplete="tel"
							maxlength="20"
							placeholder="Misalnya 0812 3456 7890"
							aria-invalid={contactError}
							aria-describedby={contactError ? `${uid}-wa-error` : undefined}
							bind:value={trip.whatsapp}
						/>
						{#if contactError}
							<p id="{uid}-wa-error" class="mt-1.5 text-[11px] font-semibold text-danger">
								Masukkan nomor Indonesia yang valid, misalnya 081234567890.
							</p>
						{/if}
					</div>

					<fieldset class="m-0 min-w-0 border-0 p-0">
						<legend class="{label} p-0">Pilih paket (boleh lebih dari satu)</legend>
						{#if packages.length === 0}
							<p class="text-xs text-muted">Paket sedang disiapkan.</p>
						{:else}
							<div class="grid gap-2 sm:grid-cols-2">
								{#each packages as p (p.slug)}
									{@const on = trip.has(p.slug)}
									<label
										class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors {on
											? 'border-green-900 bg-cream'
											: 'border-line bg-white hover:bg-cream'}"
									>
										<input
											type="checkbox"
											class="mt-0.5 size-4 shrink-0 accent-green-900"
											checked={on}
											onchange={() => trip.toggle(p.slug)}
										/>
										<span class="min-w-0">
											<span class="block text-xs font-bold">{p.title}</span>
											<span class="block text-[11px] text-muted">
												{p.price_per_person === null ? 'Harga menyusul' : `${formatRupiah(p.price_per_person)} / orang`}
											</span>
											{#if p.min_pax > 1}
												<span class="block text-[10px] text-muted">Minimal {p.min_pax} peserta</span>
											{/if}
										</span>
									</label>
								{/each}
							</div>
						{/if}
					</fieldset>

					<div class="grid gap-5 sm:grid-cols-2">
						<div>
							<label for="{uid}-pax" class={label}>Jumlah peserta</label>
							<input
								id="{uid}-pax"
								class="{field} {paxError ? 'border-danger' : ''}"
								inputmode="numeric"
								autocomplete="off"
								placeholder="Misalnya 40"
								aria-invalid={paxError}
								aria-describedby={paxError ? `${uid}-pax-error` : undefined}
								bind:value={trip.pax}
							/>
							{#if paxError}
								<p id="{uid}-pax-error" class="mt-1.5 text-[11px] font-semibold text-danger">
									Masukkan bilangan bulat 1 sampai {MAX_PAX.toLocaleString('id-ID')}.
								</p>
							{/if}
						</div>
						<div>
							<label for="{uid}-date" class={label}>Tanggal rencana (opsional)</label>
							<input id="{uid}-date" type="date" class={field} bind:value={trip.date} />
						</div>
					</div>

					<div>
						<label for="{uid}-notes" class={label}>Catatan (opsional)</label>
						<textarea
							id="{uid}-notes"
							class="{field} min-h-24 resize-y"
							maxlength="1500"
							rows="3"
							placeholder="Kebutuhan makan, penginapan, atau hal lain yang perlu diketahui."
							bind:value={trip.notes}
						></textarea>
					</div>
				</div>
			</form>

			<div class="on-light h-fit rounded-xl bg-cream p-5 text-green-900 sm:p-7 lg:sticky lg:top-24">
				<div class="eyebrow text-muted">ESTIMASI TRIP</div>

				{#if estimate.state === 'empty'}
					<p class="my-5 text-sm font-bold">Pilih minimal satu paket</p>
					<p class="text-xs text-muted">Pilih dari daftar di samping atau tombol "Tambah ke trip" pada paket.</p>
				{:else if estimate.state === 'invalid-pax'}
					<p class="my-5 text-sm font-bold">Isi jumlah peserta</p>
					<p class="text-xs text-muted">Estimasi muncul setelah jumlah peserta valid.</p>
				{:else}
					<ul class="my-4 divide-y divide-line">
						{#each estimate.lines as l (l.slug)}
							<li class="flex items-start justify-between gap-4 py-3">
								<div class="min-w-0">
									<div class="text-xs font-bold">{l.title}</div>
									{#if l.price !== null}
										<div class="text-[11px] text-muted">{l.billedPax} × {formatRupiah(l.price)}</div>
									{/if}
									{#if l.minApplied}
										<div class="text-[10px] text-muted">ditagihkan minimal {l.minPax} peserta</div>
									{/if}
								</div>
								<div class="shrink-0 text-right text-xs font-bold">
									{l.subtotal === null ? 'Harga menyusul' : formatRupiah(l.subtotal)}
								</div>
							</li>
						{/each}
					</ul>
					<p class="text-[11px] text-muted">Peserta: {pax} orang</p>
				{/if}

				<div class="mt-4 border-t border-line pt-4" aria-live="polite" aria-atomic="true">
					{#if estimate.state === 'complete' || estimate.state === 'partial' || estimate.state === 'quote-only'}
						<div class="text-[10px] font-bold tracking-wider text-muted uppercase">Total estimasi</div>
						<div class="text-2xl font-black tracking-tight">{totalText(estimate)}</div>
						{#if totalNote(estimate)}
							<div class="text-[11px] text-muted">{totalNote(estimate)}</div>
						{/if}
					{/if}
				</div>

				<div class="mt-5 grid gap-2.5">
					{#if waNumber}
						<Button
							variant="accent"
							disabled={!ready || status.kind === 'busy'}
							aria-describedby="{uid}-hint"
							onclick={sendWhatsapp}
						>
							{status.kind === 'busy' ? 'Menyiapkan…' : 'Kirim ke WhatsApp'}
							<span aria-hidden="true">↗</span>
						</Button>
					{:else}
						<p class="text-[11px] text-muted">Pengiriman lewat WhatsApp sedang tidak aktif.</p>
					{/if}
				</div>

				<p id="{uid}-hint" class="mt-3 text-[11px] text-muted">
					{#if !ready}
						Lengkapi dulu: {missing.join(', ')}.
					{:else}
						{DISCLAIMER}
					{/if}
				</p>

				<div class="mt-3 min-h-5 text-[11px]" role="status" aria-live="polite">
					{#if status.kind === 'error'}
						<p class="font-semibold text-danger">{status.message}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</section>
