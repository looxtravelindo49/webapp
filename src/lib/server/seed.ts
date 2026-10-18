import { run, scalar, transaction, type Db } from './db';

type SeedPackage = {
	slug: string;
	title: string;
	summary: string;
	body: string;
	includes: string;
	notes: string;
	image: string;
	image_alt: string;
	duration: string;
};

// Teks Offroad, Team Building, Paintball, dan Fun Games disalin dari konten situs lama.
// DRAFT: teks Rafting ditulis ulang mengikuti pola yang sama; pemilik perlu memeriksa dan
// menyesuaikannya (lokasi dan fasilitas) lewat CMS.
export const seedPackages: SeedPackage[] = [
	{
		slug: 'offroad',
		title: 'Offroad',
		summary: 'Keluar dari rutinitas dan nikmati suasana hutan bersama tim.',
		body: 'Nikmati kegiatan offroad di kawasan Cikole bersama tim. Diskusikan rencana tanggal dan jumlah peserta agar rute, operator, kendaraan, serta durasi dapat disesuaikan.',
		includes: 'Pilihan rute dan operator\nKebutuhan kendaraan\nOpsi makan setelah kegiatan',
		notes:
			'Rute, kapasitas kendaraan, fasilitas, dan biaya mengikuti penawaran operator yang dikonfirmasi. Ikuti briefing dan arahan pemandu.',
		image: '/media/forest.svg',
		image_alt: 'Ilustrasi jeep di hutan pinus; ganti dengan dokumentasi asli.',
		duration: 'Sesuai program'
	},
	{
		slug: 'team-building',
		title: 'Team Building',
		summary: 'Rancang kegiatan yang selaras dengan tujuan dan kebutuhan timmu.',
		body: 'Mulai dari tujuan kegiatan: membangun komunikasi, kerja sama, atau menguatkan kebersamaan tim.\n\nSetelah tujuannya jelas, diskusikan bentuk permainan, fasilitator, waktu kegiatan, dan tempat yang sesuai dengan peserta.',
		includes: 'Konsep kegiatan sesuai brief\nPilihan fasilitator dan lokasi\nOpsi dokumentasi',
		notes:
			'Permainan, fasilitas, fasilitator, lokasi, dan durasi ditentukan dalam penawaran. Siapkan alternatif kegiatan saat cuaca berubah.',
		image: '/media/camp.svg',
		image_alt: 'Ilustrasi tenda di perbukitan; ganti dengan dokumentasi asli.',
		duration: 'Sesuai program'
	},
	{
		slug: 'rafting',
		title: 'Rafting',
		summary: 'Susuri arus sungai bersama tim dengan perahu karet dan arahan pemandu.',
		body: 'Arung jeram menjadi cara seru untuk melatih kekompakan: seluruh tim mendayung bersama mengikuti arahan pemandu.\n\nLokasi sungai, tingkat kesulitan jeram, durasi, dan perlengkapan keselamatan disesuaikan dengan jumlah dan kondisi peserta.',
		includes: 'Perahu, dayung, dan perlengkapan keselamatan\nPemandu berpengalaman\nBriefing sebelum mulai',
		notes:
			'Kegiatan mengikuti kondisi debit air dan cuaca. Peserta wajib mengikuti briefing dan memakai perlengkapan keselamatan.',
		image: '/media/river.svg',
		image_alt: 'Ilustrasi sungai di antara tebing hijau; ganti dengan dokumentasi asli.',
		duration: 'Sesuai program'
	},
	{
		slug: 'paintball',
		title: 'Paintball',
		summary: 'Permainan strategi untuk serunya adu kompak bersama teman satu tim.',
		body: 'Paintball bisa menjadi pilihan untuk kelompok yang ingin mencoba permainan strategi bersama. Susun kegiatan sesuai karakter dan kondisi peserta.\n\nDurasi, jumlah peluru, perlengkapan, arena, serta pendamping dikonfirmasi saat meminta penawaran.',
		includes: 'Pilihan arena\nPerlengkapan dan briefing\nOpsi durasi permainan',
		notes:
			'Persyaratan peserta, perlengkapan keselamatan, jumlah peluru, dan aturan permainan mengikuti ketentuan operator.',
		image: '/media/paintball.svg',
		image_alt: 'Ilustrasi arena paintball di perbukitan; ganti dengan dokumentasi asli.',
		duration: 'Sesuai program'
	},
	{
		slug: 'fun-games',
		title: 'Fun Games',
		summary: 'Permainan ringan untuk memulai obrolan dan menikmati kebersamaan.',
		body: 'Fun games memberi ruang untuk tertawa dan berinteraksi lewat permainan kelompok yang ringan. Pilih kegiatan sesuai usia dan kenyamanan peserta.\n\nDiskusikan sebagai program utama atau kombinasikan dengan aktivitas lain.',
		includes: 'Pilihan permainan kelompok\nOpsi pemandu kegiatan\nPilihan durasi dan lokasi',
		notes:
			'Jenis permainan, perlengkapan, pemandu, lokasi, dan konsumsi mengikuti penawaran yang disepakati.',
		image: '/media/camp.svg',
		image_alt: 'Ilustrasi area berkumpul di alam terbuka; ganti dengan dokumentasi asli.',
		duration: 'Sesuai program'
	}
];

export const seedSettings: Record<string, string> = {
	whatsapp: '6282120209900'
};

/**
 * Isi data awal tanpa menimpa apa pun: paket hanya jika tabel `package` kosong,
 * pengaturan hanya untuk kunci yang belum ada. Aman dijalankan di setiap start, juga bila
 * beberapa instance menjalankannya bersamaan (transaksi tulis + `OR IGNORE` pada slug/kunci unik).
 */
export async function seed(db: Db): Promise<void> {
	await transaction(db, async (tx) => {
		const count = (await scalar<number>(tx, 'SELECT COUNT(*) FROM package')) ?? 0;
		if (count === 0) {
			for (const [i, p] of seedPackages.entries()) {
				await run(
					tx,
					`INSERT OR IGNORE INTO package
						(slug, title, summary, body, includes, notes, image, image_alt, duration, price_per_person, min_pax, published, sort_order)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 1, ?)`,
					[p.slug, p.title, p.summary, p.body, p.includes, p.notes, p.image, p.image_alt, p.duration, i + 1]
				);
			}
		}
		for (const [key, value] of Object.entries(seedSettings)) {
			await run(tx, 'INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)', [key, value]);
		}
	});
}
