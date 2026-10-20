import { DP_PERCENT } from '../invoice.js';

/** Kebijakan DP dan refund. Persen uang muka mengikuti DP_PERCENT; angka lain tetap. */
export const paymentPolicyPath = '/kebijakan-pembayaran';

export const paymentPolicySummary =
	`DP ${DP_PERCENT}% dibayar maksimal 2x24 jam setelah invoice terbit. Pelunasan maksimal H-3 sebelum acara.`;

export const paymentPolicy = {
	title: 'Kebijakan pembayaran',
	description:
		`Aturan DP ${DP_PERCENT}%, pelunasan H-3, refund, reschedule, perubahan peserta, dan cuaca ekstrem untuk trip yang kamu pesan lewat kami.`,
	intro:
		'Ini aturan DP, pelunasan, refund, dan perubahan peserta untuk invoice yang kamu terima dari kami. Bacanya sampai habis sebelum kamu transfer, ya.',
	sections: [
		{
			title: 'Uang muka (DP)',
			body: `DP ${DP_PERCENT}% dibayar maksimal 2x24 jam setelah invoice terbit; tanggal baru terkunci setelah DP masuk. Untuk acara kurang dari 7 hari lagi, DP dibayar di hari yang sama.`
		},
		{
			title: 'Pelunasan',
			body: 'Pelunasan maksimal H-3 sebelum acara. Untuk korporat/instansi dengan surat konfirmasi/PO, pelunasan bisa di hari acara.'
		},
		{
			title: 'Refund',
			body: 'Refund DP jika peserta batal: H-30 atau lebih DP kembali 50%; H-14 sampai H-29 DP kembali 25%; kurang dari H-14 DP hangus. Pembayaran di luar DP dikembalikan penuh dikurangi biaya pihak ketiga yang sudah keluar (misalnya jeep, makan, tiket).'
		},
		{
			title: 'Reschedule',
			body: 'Reschedule gratis 1 kali jika diajukan paling lambat H-7, tanggal baru maksimal 3 bulan dari tanggal awal; DP tetap berlaku. Kurang dari H-7 atau reschedule kedua mengikuti aturan pembatalan.'
		},
		{
			title: 'Perubahan peserta',
			body: 'Perubahan peserta: tambah sampai H-3 dengan harga per orang yang sama sesuai ketersediaan; kurangi sampai H-7 tanpa potong DP selama tetap di atas minimal peserta; lewat H-7 tagihan dihitung dari jumlah yang dikonfirmasi. Offroad: Rp249rb/orang untuk kelipatan 7; bila bukan kelipatan 7, Rp1.750.000 per mobil dibagi penumpangnya.'
		},
		{
			title: 'Cuaca ekstrem',
			body: 'Cuaca ekstrem/force majeure: jika Loox/operator membatalkan demi keselamatan, atau ada bencana/aturan pemerintah, peserta memilih reschedule gratis (maks 3 bulan) atau refund DP penuh dikurangi biaya pihak ketiga yang tidak bisa ditarik. Hujan biasa bukan force majeure; aktivitas tetap jalan atau dialihkan.'
		}
	]
} as const;
