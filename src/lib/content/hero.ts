export const hero = {
	chips: ['OFFROAD', 'TEAM BUILDING', 'RAFTING', 'PAINTBALL', 'FUN GAMES'],
	titleLines: ['Bawa timmu', 'keluar dari'],
	titleEmphasis: 'rutinitas.',
	description:
		'Pilih serunya kegiatan di Lembang dan sekitarnya. Ceritakan rencana timmu, kita susun perjalanan yang pas bersama.',
	desktopImage: '/images/hero/hero-renaissance-1-desktop.webp',
	mobileImage: '/images/hero/hero-renaissance-1-mobile.webp',
	imageWidth: 1920,
	imageHeight: 1080,
	imageAlt:
		'Lukisan gaya Renaissance: rombongan jeep offroad biru melintasi jalur hutan pinus Lembang, peserta duduk di dalam mobil memakai helm adventure.',
	primaryCta: { label: 'Temukan ide trip', href: '#paket' },
	chatCta: { label: 'Chat kami' },
	promise: ['Program bisa disesuaikan', 'Sesuai kebutuhan tim', 'Konsultasi sebelum booking']
} as const;

/** Potret dipakai di layar sempit dan di tablet potret. Layar lebar lanskap memakai foto desktop. */
export const HERO_MOBILE_MEDIA = '(max-width: 767px), (max-width: 1024px) and (orientation: portrait)';
export const HERO_DESKTOP_MEDIA = '(min-width: 1025px), (min-width: 768px) and (orientation: landscape)';
