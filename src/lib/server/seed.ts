import { GOOGLE_RATING_SETTING, GOOGLE_REVIEW_COUNT_SETTING } from '#lib/content/reviews.js';
import { all, run, scalar, transaction, type Db, type Queryable } from './db';

type SeedPackage = {
	slug: string;
	title: string;
	summary: string;
	body: string;
	includes: string;
	notes: string;
	image: string;
	image_alt: string;
	/** `null` = admin yang mengisi. Hanya dipakai saat tabel package masih kosong. */
	duration: string | null;
	/** Hanya untuk database kosong. Situs yang sudah terisi memakai min_pax di admin. */
	min_pax: number;
	/** Hanya untuk database kosong. Situs yang sudah terisi memakai pengaturan di admin. */
	pricing_mode?: 'per_person' | 'per_unit';
	kapasitas_per_unit?: number | null;
	nama_unit?: string | null;
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
		duration: '2-3 Jam',
		min_pax: 7,
		pricing_mode: 'per_unit',
		kapasitas_per_unit: 7,
		nama_unit: 'mobil'
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
		duration: null,
		min_pax: 20
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
		duration: null,
		min_pax: 5
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
		duration: null,
		min_pax: 10
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
		duration: null,
		min_pax: 20
	}
];

type SeedArticle = {
	slug: string;
	title: string;
	category: string;
	excerpt: string;
	body: string;
	cover_image: string;
	cover_alt: string;
	published_at: string;
};

// Tiga artikel yang sebelumnya statis di beranda. Tanggal tetap, artikel pertama paling baru,
// supaya urutan tampil sama dengan sebelumnya (terbaru dulu).
export const seedArticles: SeedArticle[] = [
	{
		slug: 'sepakati-5-hal-sebelum-gathering-kantor',
		title: 'Mau gathering kantor? Sepakati 5 hal ini dulu.',
		category: 'PERENCANAAN',
		excerpt: 'Tujuan, jumlah peserta, tanggal, kisaran anggaran, dan titik keberangkatan sudah cukup untuk mulai berdiskusi dengan penyelenggara.',
		body: 'Mulai dengan tujuan kegiatan. Apakah tim ingin beristirahat, saling mengenal, atau merayakan pencapaian? Jawaban ini membantu memilih aktivitas yang tepat.\n\nSetelah itu, sepakati jumlah peserta, tanggal, kisaran anggaran, dan titik keberangkatan. Lima hal ini sudah cukup untuk memulai diskusi dengan penyelenggara.\n\nCatat juga kebutuhan khusus peserta, seperti makanan, mobilitas, atau jadwal ibadah. Detail kecil sering menentukan kenyamanan perjalanan.',
		cover_image: '/media/camp.svg',
		cover_alt: 'Ilustrasi tenda di perbukitan',
		published_at: '2026-09-15T00:00:00.000Z'
	},
	{
		slug: 'offroad-atau-pantai-kenali-selera-timmu',
		title: 'Offroad atau santai di pantai? Kenali selera timmu.',
		category: 'PILIH KEGIATAN',
		excerpt: 'Ajak tim menyampaikan keinginan dan batas kenyamanannya sebelum memilih aktivitas, lalu sesuaikan dengan waktu dan tujuan acara.',
		body: 'Sebelum memilih aktivitas, ajak tim menyampaikan keinginan dan batas kenyamanannya. Aktivitas yang seru bagi sebagian orang belum tentu cocok untuk semua peserta.\n\nOffroad bisa menjadi bahan obrolan baru untuk tim yang menyukai petualangan. Kegiatan pantai memberi ruang lebih fleksibel untuk berkumpul dan bersantai.\n\nPilih program dengan mempertimbangkan kondisi peserta, waktu perjalanan, dan tujuan acara. Sisakan pilihan aktivitas ringan bagi yang membutuhkan.',
		cover_image: '/media/forest.svg',
		cover_alt: 'Ilustrasi hutan pinus',
		published_at: '2026-09-08T00:00:00.000Z'
	},
	{
		slug: 'itinerary-enak-tidak-harus-padat-acara',
		title: 'Itinerary yang enak tidak harus padat acara.',
		category: 'TIPS PANITIA',
		excerpt: 'Sisakan waktu untuk perpindahan, istirahat, makan, dan persiapan agar peserta tetap segar sampai acara terakhir.',
		body: 'Sisakan waktu untuk perpindahan, istirahat, makan, dan persiapan. Jadwal tanpa jeda mudah membuat peserta lelah dan acara berikutnya terlambat.\n\nTentukan beberapa kegiatan utama sebagai prioritas. Kegiatan tambahan bisa menyesuaikan kondisi di lokasi.\n\nSepakati siapa yang mengambil keputusan saat cuaca berubah atau perjalanan melambat. Siapkan rencana cadangan yang tetap nyaman untuk peserta.',
		cover_image: '/media/river.svg',
		cover_alt: 'Ilustrasi sungai di antara tebing hijau',
		published_at: '2026-09-01T00:00:00.000Z'
	}
];

/** Ulasan asli dari Google. Tanggal dikosongkan karena tidak disertakan. */
export const seedGoogleReviews: { name: string; rating: number; body: string }[] = [
	{
		name: 'Axel Van Basten Pakpahan',
		rating: 5,
		body: 'Loox Travel provides excellent, responsive service. The team is friendly, gives clear information, and makes the booking process smooth from start to finish. The trip was also enjoyable, well organized, and hassle free. Highly recommended for anyone looking for a reliable and convenient travel agent. Thank you, Loox Travel!'
	},
	{
		name: 'Khalid Alkhawarizmi',
		rating: 5,
		body: 'Aku diminta cari eo untuk gathering kantor di Bandung, dan setelah cari2 yang proper.. ketemu lah Loox Travel ini\n\nRespon nya gercep, presentasi bagus, eksekusinya lebih baguss lagi!\n\nThank you Loox Travel, kemarin handle 100 orang kantor dan semuanya bilang good job!\n\nBuat temen-temen yang mau gathering di Lembang atau destinasi lain, aku rekomendasikan Loox Travel ajaaa!'
	},
	{
		name: 'Putri Hasna',
		rating: 5,
		body: 'Pengalaman ikut Loox Travel bener-bener seruu! Dari awal sampai akhir semuanya terasa nyaman dan terorganisir dengan baik. Adminnya responsif, informasinya jelas, dan selama perjalanan juga dibantu dengan baikkk\n\nPelayanannya ramah, itinerary-nya seru, dan perjalanan jadi terasa lebih santai karena semuanya sudah diatur. Terima kasih Loox Travel untuk pengalaman yang menyenangkan! 🥰✨\n\nBuat yang sedang cari travel untuk liburan, aku rekomendasikan Loox Travel. Semoga bisa ikut trip berikutnya lagi! ❤️'
	},
	{
		name: 'Realisna Putri',
		rating: 5,
		body: 'Dari sekian banyak trip kantor, yang ini salah satu yang paling berkesan karena acaranya gak berasa kaku dan semuanya enjoy 👌'
	},
	{
		name: 'Liani Qolby',
		rating: 5,
		body: 'Pulang-pulang bukannya kapok malah pengen jalan lagi, thankyou looxtravel udah bikin trip kemarin susah dilupain 👀✌️'
	}
];

/** Nama pada seed lama. Dipakai sekali untuk mengganti Ira Sri dan winda widyawati. */
const previousSeedNames = new Set(['Axel Van Basten Pakpahan', 'Ira Sri', 'winda widyawati']);
const retiredSeedReviews = [
	{ name: 'Ira Sri', body: 'Wih keren Loox travel, sangat rekomend...' },
	{ name: 'winda widyawati', body: 'Kereen... Terima Kasih...' }
];

export const seedSettings: Record<string, string> = {
	whatsapp: '6282120209900',
	[GOOGLE_RATING_SETTING]: '5.0',
	[GOOGLE_REVIEW_COUNT_SETTING]: '41'
};

/**
 * Isi data awal tanpa menimpa apa pun: paket hanya jika tabel `package` kosong,
 * artikel bawaan tepat sekali (penanda `seeded_articles`, jadi tidak muncul lagi walau admin menghapusnya),
 * lima ulasan Google tepat sekali (penanda `seeded_google_reviews`; basis yang masih
 * menyimpan seed lama diganti sekali lewat `seeded_google_reviews_5`),
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
						(slug, title, summary, body, includes, notes, image, image_alt, duration, price_per_person, min_pax,
						 pricing_mode, kapasitas_per_unit, nama_unit, published, sort_order)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1, ?)`,
					[
						p.slug, p.title, p.summary, p.body, p.includes, p.notes, p.image, p.image_alt, p.duration, p.min_pax,
						p.pricing_mode ?? 'per_person', p.kapasitas_per_unit ?? null, p.nama_unit ?? null, i + 1
					]
				);
			}
		}
		const articlesSeeded = await scalar(tx, "SELECT 1 FROM setting WHERE key = 'seeded_articles'");
		if (articlesSeeded === null) {
			for (const a of seedArticles) {
				await run(
					tx,
					`INSERT OR IGNORE INTO article
						(slug, title, category, excerpt, body, cover_image, cover_alt, published, featured, published_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
					[a.slug, a.title, a.category, a.excerpt, a.body, a.cover_image, a.cover_alt, a.published_at]
				);
			}
			await run(tx, "INSERT OR IGNORE INTO setting (key, value) VALUES ('seeded_articles', '1')");
		}
		const reviewsSeeded = await scalar(tx, "SELECT 1 FROM setting WHERE key = 'seeded_google_reviews'");
		if (reviewsSeeded === null) {
			const reviewCount = (await scalar<number>(tx, 'SELECT COUNT(*) FROM testimonial')) ?? 0;
			if (reviewCount === 0) await insertSeedReviews(tx);
			await run(tx, "INSERT OR IGNORE INTO setting (key, value) VALUES ('seeded_google_reviews', '1')");
			await run(tx, "INSERT OR IGNORE INTO setting (key, value) VALUES ('seeded_google_reviews_5', '1')");
		} else if ((await scalar(tx, "SELECT 1 FROM setting WHERE key = 'seeded_google_reviews_5'")) === null) {
			await replacePreviousSeedReviews(tx);
			await run(tx, "INSERT OR IGNORE INTO setting (key, value) VALUES ('seeded_google_reviews_5', '1')");
		}
		for (const [key, value] of Object.entries(seedSettings)) {
			await run(tx, 'INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)', [key, value]);
		}
	});
}

async function insertReview(tx: Queryable, review: (typeof seedGoogleReviews)[number], order: number) {
	await run(
		tx,
		`INSERT INTO testimonial (reviewer_name, rating, body, review_date, source_url, sort_order)
		 VALUES (?, ?, ?, '', NULL, ?)`,
		[review.name, review.rating, review.body, order]
	);
}

async function insertSeedReviews(tx: Queryable) {
	for (const [i, review] of seedGoogleReviews.entries()) await insertReview(tx, review, i + 1);
}

/** Ganti seed lama (Ira Sri, winda widyawati) dengan lima ulasan. Ulasan lain milik admin tidak dihapus. */
async function replacePreviousSeedReviews(tx: Queryable) {
	const rows = await all<{ reviewer_name: string; body: string }>(tx, 'SELECT reviewer_name, body FROM testimonial');
	const onlyPrevious = rows.length === 0 || rows.every((row) => previousSeedNames.has(row.reviewer_name));
	if (onlyPrevious) {
		await run(tx, 'DELETE FROM testimonial');
		await insertSeedReviews(tx);
		return;
	}
	for (const old of retiredSeedReviews) {
		await run(tx, 'DELETE FROM testimonial WHERE reviewer_name = ? AND body = ?', [old.name, old.body]);
	}
	for (const review of seedGoogleReviews) {
		const exists = await scalar(tx, 'SELECT 1 FROM testimonial WHERE reviewer_name = ? AND body = ?', [review.name, review.body]);
		if (exists !== null) continue;
		const order = (await scalar<number>(tx, 'SELECT COALESCE(MAX(sort_order), 0) + 1 FROM testimonial')) ?? 1;
		await insertReview(tx, review, order);
	}
}
