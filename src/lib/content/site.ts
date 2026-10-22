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

export const navLinks = [
	{ label: 'Pilihan Paket', href: '/#paket' },
	{ label: 'Portfolio', href: '/portfolio' },
	{ label: 'Artikel', href: '/artikel' },
	{ label: 'Rencanakan Trip', href: '/#rencanakan' }
] as const;
