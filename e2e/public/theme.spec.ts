import type { Page } from '@playwright/test';
import { calc } from '../support/calculator';
import { expect, gotoReady, test } from '../support/fixtures';

// Nilai dari openspec/specs/site-shell (requirement "Tema warna").
const TOKENS: Record<string, string> = {
	'--color-green-900': '#113a33',
	'--color-green-800': '#1b4d44',
	'--color-green-100': '#e7efec',
	'--color-accent': '#f3d284',
	'--color-accent-700': '#8a6414',
	'--color-surface': '#ffffff',
	'--color-cream': '#f8f6ee',
	'--color-muted': '#5d716b'
};

/** Hex pendek (#fff, hasil minifikasi CSS) dinormalisasi ke enam digit huruf kecil. */
const normalizeHex = (v: string) => {
	const h = v.trim().toLowerCase();
	return /^#[0-9a-f]{3}$/.test(h) ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
};

type Target = { name: string; css?: string; tag?: string; text?: string };

/** Rasio kontras warna teks terhadap latar efektif (leluhur terdekat yang tidak transparan). */
async function contrast(page: Page, targets: Target[]) {
	return page.evaluate((list) => {
		// Konversi lewat kanvas: tahan terhadap sintaks warna terkomputasi apa pun (rgb(), color(srgb …), color-mix()).
		const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		const parse = (c: string) => {
			ctx.clearRect(0, 0, 1, 1);
			ctx.fillStyle = '#000';
			ctx.fillStyle = c;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
			return [r, g, b, a / 255];
		};
		const lum = ([r, g, b]: number[]) => {
			const f = [r, g, b].map((v) => {
				const s = v / 255;
				return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			});
			return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
		};
		const bgOf = (el: Element | null): number[] => {
			for (let e = el; e; e = e.parentElement) {
				const [r, g, b, a = 1] = parse(getComputedStyle(e).backgroundColor);
				if (a > 0.9) return [r, g, b];
			}
			return [255, 255, 255];
		};
		const ratio = (a: number[], b: number[]) => {
			const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
			return (hi + 0.05) / (lo + 0.05);
		};
		return list.map((t) => {
			const el = t.css
				? document.querySelector(t.css)
				: [...document.querySelectorAll(t.tag ?? '*')].find((e) => e.textContent?.includes(t.text ?? '') && e.children.length <= 1) ?? null;
			if (!el) return { name: t.name, ratio: 0, found: false };
			return { name: t.name, ratio: ratio(parse(getComputedStyle(el).color).slice(0, 3), bgOf(el)), found: true };
		});
	}, targets);
}

test.describe('[site-shell] Tema warna', () => {
	test('semua token tersedia sebagai custom property dengan nilai hex dari spec', async ({ page }) => {
		await gotoReady(page, '/');
		const values = await page.evaluate(
			(names) => Object.fromEntries(names.map((n) => [n, getComputedStyle(document.documentElement).getPropertyValue(n)])),
			Object.keys(TOKENS)
		);
		for (const [name, expected] of Object.entries(TOKENS)) {
			expect(normalizeHex(values[name]), name).toBe(expected);
		}
	});

	test('kontras teks ≥ 4,5:1 pada Navbar, Hero, tombol, dan Footer', async ({ page }) => {
		await gotoReady(page, '/');
		await calc(page).box('Offroad').check();
		await calc(page).team.fill('Tim Alfa');
		await calc(page).pax.fill('40');
		const results = await contrast(page, [
			{ name: 'Navbar: tautan', css: 'header nav a' },
			{ name: 'Navbar: tombol Konsultasi Trip (putih di hijau)', css: 'header a[href="#konsultasi"]:not(nav a)' },
			{ name: 'Hero: judul (putih di hijau)', css: 'main > section h1' },
			{ name: 'Hero: deskripsi (hijau muda di hijau)', css: 'main > section p' },
			{ name: 'Hero: tombol emas (hijau di emas)', css: 'main > section a[href="#paket"]' },
			{ name: 'Hero: eyebrow (emas di hijau)', css: 'main > section .eyebrow' },
			{ name: 'Paket: teks sekunder (abu-hijau di putih)', css: '#paket p.text-muted' },
			{ name: 'Kalkulator: tombol Kirim ke WhatsApp (hijau di emas)', tag: 'button', text: 'Kirim ke WhatsApp' },
			{ name: 'Kalkulator: tombol Simpan PDF (hijau di putih)', tag: 'button', text: 'Simpan PDF' },
			{ name: 'Footer: merek (putih di hijau)', css: 'footer a' },
			{ name: 'Footer: keterangan (hijau muda di hijau)', css: 'footer p' }
		]);
		for (const r of results) {
			expect(r.found, `${r.name}: elemen ditemukan`).toBe(true);
			expect(r.ratio, `${r.name}: kontras ${r.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
		}
	});

	test('emas (accent) tidak pernah menjadi warna teks di atas latar terang', async ({ page }) => {
		await gotoReady(page, '/');
		// Semua elemen yang memiliki teks sendiri dan berwarna emas harus berlatar gelap (kontras ≥ 4,5:1).
		const offenders = await page.evaluate(() => {
			const ACCENT = '243, 210, 132';
			// Konversi lewat kanvas: tahan terhadap sintaks warna terkomputasi apa pun (rgb(), color(srgb …), color-mix()).
		const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
		const parse = (c: string) => {
			ctx.clearRect(0, 0, 1, 1);
			ctx.fillStyle = '#000';
			ctx.fillStyle = c;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
			return [r, g, b, a / 255];
		};
			const lum = ([r, g, b]: number[]) => {
				const f = [r, g, b].map((v) => {
					const s = v / 255;
					return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
				});
				return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
			};
			const bgOf = (el: Element): number[] => {
				for (let e: Element | null = el; e; e = e.parentElement) {
					const [r, g, b, a = 1] = parse(getComputedStyle(e).backgroundColor);
					if (a > 0.9) return [r, g, b];
				}
				return [255, 255, 255];
			};
			const bad: string[] = [];
			let goldTexts = 0;
			for (const el of document.querySelectorAll('body *')) {
				const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
				if (!hasOwnText) continue;
				const rgba = parse(getComputedStyle(el).color);
				if (rgba.slice(0, 3).join(', ') !== ACCENT || rgba[3] < 0.99) continue;
				goldTexts++;
				const [hi, lo] = [lum(rgba.slice(0, 3)), lum(bgOf(el))].sort((a, b) => b - a);
				const ratio = (hi + 0.05) / (lo + 0.05);
				if (ratio < 4.5) bad.push(`${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 30)}" ${ratio.toFixed(2)}:1`);
			}
			return { bad, goldTexts };
		});
		expect(offenders.goldTexts, 'ada teks emas di atas hijau (eyebrow, aksen judul) yang ikut diperiksa').toBeGreaterThan(0);
		expect(offenders.bad).toEqual([]);
	});
});
