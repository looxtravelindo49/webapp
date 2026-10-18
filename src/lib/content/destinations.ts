export type Destination = {
	place: string;
	tagline: string;
	image: string;
	/** Judul ide perjalanan yang tampil di dialog. */
	name: string;
	desc: string;
	meta: string;
	detail: string;
};

export const destinationsSection = {
	eyebrow: 'JAUH DARI MEJA KERJA',
	title: 'Mau suasana yang mana?',
	sub: 'Pilih destinasi untuk melihat ide perjalanannya.'
} as const;

export const destinations: Destination[] = [
	{
		place: 'Lembang',
		tagline: 'HUTAN & PETUALANGAN',
		image: '/media/forest.svg',
		name: 'Offroad bareng satu tim',
		desc: 'Keluar dari rutinitas, masuk ke suasana hutan. Ide trip sehari untuk tim yang suka petualangan.',
		meta: '1 hari · Program offroad',
		detail:
			'Ajak tim menikmati suasana hutan dengan kegiatan offroad. Jadikan momen di perjalanan sebagai kesempatan ngobrol di luar urusan pekerjaan.\n\nIde alur kegiatan: berkumpul → persiapan dan briefing operator → sesi offroad → makan bersama → perjalanan pulang.\n\nRute, operator, kapasitas kendaraan, durasi, fasilitas makan, dan biaya perlu disepakati dalam penawaran.'
	},
	{
		place: 'Pangandaran',
		tagline: 'PANTAI & WAKTU SANTAI',
		image: '/media/coast.svg',
		name: 'Ganti layar dengan debur ombak',
		desc: 'Waktu santai di pantai, obrolan tanpa buru-buru, dan ruang untuk menikmati kebersamaan.',
		meta: '2 hari 1 malam · Wisata pantai',
		detail:
			'Pilihan suasana pantai untuk perjalanan bersama tim. Susun agenda dengan waktu istirahat yang cukup agar kegiatan terasa nyaman.\n\nIde alur kegiatan: perjalanan ke Pangandaran → check-in → waktu santai → makan malam bersama → kegiatan pagi → perjalanan pulang.\n\nHotel, transportasi, aktivitas, fasilitas makan, dan biaya disesuaikan dengan kebutuhan. Kegiatan pantai mengikuti kondisi cuaca dan arahan petugas setempat.'
	},
	{
		place: 'Garut',
		tagline: 'ALAM & KEBERSAMAAN',
		image: '/media/camp.svg',
		name: 'Lebih dekat, di tengah alam',
		desc: 'Padukan acara kebersamaan dengan kegiatan tim dan waktu menikmati udara pegunungan.',
		meta: '2 hari 1 malam · Gathering',
		detail:
			'Bangun suasana yang lebih akrab lewat gathering di kawasan Garut. Pilih tempat dan aktivitas sesuai karakter peserta.\n\nIde alur kegiatan: tiba di venue → makan bersama → kegiatan tim → acara malam → waktu santai → perjalanan pulang.\n\nVenue, penginapan, permainan, konsumsi, transportasi, dan biaya dirinci dalam penawaran. Aktivitas luar ruang memerlukan rencana cadangan saat hujan.'
	}
];
