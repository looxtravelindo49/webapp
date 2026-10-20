import { describe, expect, it } from 'vitest';
import { DEFAULT_WA_MESSAGE, FLOAT_WA_TEMPLATE, floatWaMessage, normalizeWhatsapp, waLink } from './whatsapp';
import { formatRupiah } from './format';

describe('normalizeWhatsapp', () => {
	it.each([
		['0821-2020-9900', '6282120209900'],
		['+62 821 2020 9900', '6282120209900'],
		['6282120209900', '6282120209900'],
		[' 0821 2020 9900 ', '6282120209900']
	])('%s → %s', (input, expected) => {
		expect(normalizeWhatsapp(input)).toBe(expected);
	});

	it.each(['12345', '', '   ', 'abc', '620821', '0', '+1 555 123 4567'])('menolak %j', (input) => {
		expect(normalizeWhatsapp(input)).toBeNull();
	});

	it('menolak null dan undefined', () => {
		expect(normalizeWhatsapp(null)).toBeNull();
		expect(normalizeWhatsapp(undefined)).toBeNull();
	});
});

describe('waLink', () => {
	it('memakai pesan default yang ter-encode', () => {
		expect(waLink('6282120209900')).toBe(
			'https://wa.me/6282120209900?text=Halo%20Lembang%20Adventure%2C%20saya%20ingin%20konsultasi%20trip.'
		);
		expect(DEFAULT_WA_MESSAGE).toContain('Lembang Adventure');
	});

	it('meng-encode pesan kustom', () => {
		expect(waLink('6281', 'a b&c\nd')).toBe('https://wa.me/6281?text=a%20b%26c%0Ad');
	});

	it('template chat mengambang mengajak isi detail, dan halaman paket mengisi kegiatan', () => {
		expect(FLOAT_WA_TEMPLATE).toContain('Halo Lembang Adventure! 👋');
		expect(FLOAT_WA_TEMPLATE).toContain('Nama: \n');
		expect(FLOAT_WA_TEMPLATE).toContain(
			'Kegiatan yang diminati (Offroad/Rafting/Paintball/Team Building/Fun Games/Gathering): \n'
		);
		expect(FLOAT_WA_TEMPLATE).toContain('Mohon info paket dan penawarannya ya, terima kasih!');
		const filled = floatWaMessage('Offroad');
		expect(filled).toContain(
			'Kegiatan yang diminati (Offroad/Rafting/Paintball/Team Building/Fun Games/Gathering): Offroad\n'
		);
		expect(floatWaMessage('  ')).toBe(FLOAT_WA_TEMPLATE);
		expect(waLink('6282120209900', floatWaMessage('Team Building'))).toContain(encodeURIComponent('Team Building'));
	});
});

describe('formatRupiah', () => {
	it('memakai pemisah ribuan titik', () => {
		expect(formatRupiah(250000)).toBe('Rp 250.000');
		expect(formatRupiah(1500000)).toBe('Rp 1.500.000');
		expect(formatRupiah(0)).toBe('Rp 0');
	});
});

import { safeImage, FALLBACK_IMAGE } from './images';
import { lines, paragraphs } from './text';

describe('safeImage', () => {
	it('menerima path media dan uploads', () => {
		expect(safeImage('/media/river.svg')).toBe('/media/river.svg');
		expect(safeImage('/uploads/foto-1.jpg')).toBe('/uploads/foto-1.jpg');
	});
	it.each([null, undefined, '', 'https://x.com/a.png', '/media/../etc/passwd.png', '/media/a.exe', '//evil.com/a.png', 'javascript:alert(1)'])(
		'menolak %j',
		(p) => expect(safeImage(p as string | null)).toBe(FALLBACK_IMAGE)
	);
});

describe('text helpers', () => {
	it('paragraphs memecah per baris kosong', () => {
		expect(paragraphs('a\nb\n\n  c  \n\n\nd')).toEqual(['a\nb', 'c', 'd']);
		expect(paragraphs(null)).toEqual([]);
	});
	it('lines membuang bullet dan baris kosong', () => {
		expect(lines('- satu\n• dua\n\n tiga ')).toEqual(['satu', 'dua', 'tiga']);
	});
});
