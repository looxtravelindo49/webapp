import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PromoPopup from './components/PromoPopup.svelte';
import {
	DEFAULT_PROMO,
	PROMO_SUPPRESS_KEY,
	parsePromoForm,
	promoCopy,
	promoDismissKey,
	promoEndsAt,
	promoFromStored,
	promoIsLive
} from './promo';

describe('promoIsLive', () => {
	const at = (iso: string) => new Date(iso);

	it('hidup sampai 1 Nov 2026 00:00 WIB dan mati setelahnya atau bila dimatikan', () => {
		expect(promoEndsAt('2026-11-01T00:00')?.toISOString()).toBe('2026-10-31T17:00:00.000Z');
		expect(promoIsLive(DEFAULT_PROMO, at('2026-10-25T00:00:00+07:00'))).toBe(true);
		expect(promoIsLive(DEFAULT_PROMO, at('2026-10-31T23:59:00+07:00'))).toBe(true);
		expect(promoIsLive(DEFAULT_PROMO, at('2026-11-01T00:00:00+07:00'))).toBe(false);
		expect(promoIsLive({ ...DEFAULT_PROMO, enabled: false }, at('2026-10-25T00:00:00+07:00'))).toBe(false);
		expect(promoIsLive({ ...DEFAULT_PROMO, endsAt: 'besok' })).toBe(false);
	});
});

describe('promoDismissKey', () => {
	it('stabil untuk isi yang sama dan berubah bila promo diedit', () => {
		expect(PROMO_SUPPRESS_KEY).toBe('la_promo_suppress');
		const key = promoDismissKey(DEFAULT_PROMO);
		expect(promoDismissKey({ ...DEFAULT_PROMO })).toBe(key);
		expect(promoDismissKey({ ...DEFAULT_PROMO, amount: 'Rp400.000' })).not.toBe(key);
		const hidden: typeof DEFAULT_PROMO = { ...DEFAULT_PROMO, enabled: false };
		expect(promoDismissKey(hidden)).toBe(key);
	});
});

describe('promoCopy', () => {
	it('memisahkan paragraf dan langkah bernomor', () => {
		expect(promoCopy(DEFAULT_PROMO.conditions)).toEqual({
			lead: 'Untuk booking grup di atas 30 orang. Berlaku sampai 31 Oktober 2026.',
			steps: ['Isi form paket secara lengkap.', 'Hubungi kami untuk klaim diskon.']
		});
	});
});

describe('promoFromStored', () => {
	it('jatuh ke bawaan bila kosong atau rusak, dan menghormati mati', () => {
		expect(promoFromStored(null)).toEqual(DEFAULT_PROMO);
		expect(promoFromStored('{')).toEqual(DEFAULT_PROMO);
		expect(promoFromStored(JSON.stringify({ enabled: false, endsAt: '2026-12-01T08:30:00' })).enabled).toBe(false);
		expect(promoFromStored(JSON.stringify({ enabled: false, endsAt: '2026-12-01T08:30:00' })).endsAt).toBe('2026-12-01T08:30');
		expect(promoFromStored(JSON.stringify({ image: 'https://evil.example/a.jpg' })).image).toBe(DEFAULT_PROMO.image);
	});
});

describe('parsePromoForm', () => {
	const form = (over: Record<string, string> = {}) => ({
		get: (name: string) =>
			({
				enabled: '1',
				label: 'Promo Oktober',
				title: 'Diskon up to',
				amount: 'Rp500.000',
				conditions: 'Syarat grup.\n1. Isi form.',
				ends_at: '2026-11-01T00:00',
				cta: 'Isi Form Paket',
				image_alt: 'Foto tim',
				current_image: '/media/promo-team.webp',
				...over
			})[name] ?? null
	});

	it('menerima isian lengkap', () => {
		const parsed = parsePromoForm(form());
		expect(parsed.errors).toEqual({});
		expect(parsed.promo).toMatchObject({ enabled: true, label: 'Promo Oktober', endsAt: '2026-11-01T00:00', image: '/media/promo-team.webp' });
	});

	it('menolak waktu dan judul kosong; checkbox mati bila tidak dicentang', () => {
		const parsed = parsePromoForm(form({ enabled: '', title: '  ', ends_at: '2026-11-01' }));
		expect(parsed.promo.enabled).toBe(false);
		expect(parsed.errors.title).toBeTruthy();
		expect(parsed.errors.endsAt).toBeTruthy();
	});
});

describe('PromoPopup', () => {
	it('tidak merender dialog di HTML server supaya tidak menggeser tata letak', () => {
		const body = render(PromoPopup, { props: { promo: DEFAULT_PROMO } }).body;
		expect(body).not.toContain('role="dialog"');
		expect(body).not.toContain('promo-team');
	});
});
