export const site = {
	name: 'Lembang Adventure',
	byline: 'by Loox Travel · WE ORGANIZE MEMORIES.',
	topline: 'Ada rencana main ke Lembang? Mulai dari kegiatan yang paling kamu suka.',
	description:
		'Pilihan aktivitas Lembang dan sekitarnya: offroad, team building, rafting, paintball, dan fun games. Susun trip timmu bersama Lembang Adventure by Loox Travel.',
	seoTitle: 'Aktivitas & Wisata Lembang | Lembang Adventure by Loox Travel',
	activities: ['Offroad', 'Team building', 'Rafting', 'Paintball', 'Fun games'],
	footerNote: 'Aktivitas dan wisata di Lembang dan sekitarnya.'
} as const;

/** NAP bisnis. `line` untuk footer; sisanya untuk PostalAddress di JSON-LD. */
export const businessAddress = {
	streetAddress: 'Jl. Laksana II No. 59, Jayagiri',
	addressLocality: 'Lembang',
	addressRegion: 'Jawa Barat',
	postalCode: '40391',
	addressCountry: 'ID',
	line: 'Jl. Laksana II No. 59, Jayagiri, Lembang, Kabupaten Bandung Barat, Jawa Barat 40391'
} as const;

/**
 * Identitas bisnis untuk JSON-LD. Nama badan hukum dan koordinat mengikuti listing Google Maps
 * "Loox Travel - PT Loox Travel Luxury"; `mapsUrl` juga dipakai tombol ulasan Google.
 */
export const businessProfile = {
	alternateName: 'Lembang Adventure by Loox Travel',
	legalName: 'PT Loox Travel Luxury',
	geo: { latitude: -6.810069, longitude: 107.6206394 },
	mapsUrl:
		'https://www.google.com/maps/place/Loox+Travel+-+PT+Loox+Travel+Luxury/@-6.810069,107.6206394,17z/data=!4m8!3m7!1s0x2e68e196d5f5124b:0x84f49e021326b3eb!8m2!3d-6.810069!4d107.6206394!9m1!1b1!16s%2Fg%2F11ytjl1nr1',
	areaServed: ['Lembang', 'Bandung']
} as const;

export const navLinks = [
	{ label: 'Pilihan Paket', href: '/#paket' },
	{ label: 'Portfolio', href: '/portfolio' },
	{ label: 'Artikel', href: '/artikel' },
	{ label: 'Rencanakan Trip', href: '/#rencanakan' }
] as const;
