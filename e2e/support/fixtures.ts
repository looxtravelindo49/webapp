import { readFileSync } from 'node:fs';
import { expect as baseExpect, test as base, type Browser, type BrowserContext, type Download, type Page } from '@playwright/test';
import { BASE_URL } from './env';
import { ensureFixtures } from './db';
import { PNG as PNG_1PX } from './assets';

type Fixtures = {
	/** Daftarkan pola pesan konsol yang diizinkan untuk tes ini. */
	allowConsole: (pattern: RegExp) => void;
	allowedConsole: RegExp[];
};
type WorkerFixtures = { dataFixtures: void };

// "Failed to load resource" muncul pada respons 4xx yang disengaja (mis. login gagal).
const ALWAYS_ALLOWED = [/Failed to load resource/];

/** Pasang pengumpul galat konsol ke halaman; dipakai juga untuk halaman yang dibuat manual. */
export function watchConsole(page: Page, sink: string[]): void {
	page.on('console', (m) => {
		if (m.type() === 'error' || m.type() === 'warning') sink.push(`console.${m.type()}: ${m.text()}`);
	});
	page.on('pageerror', (e) => sink.push(`pageerror: ${String(e)}`));
}

export const test = base.extend<Fixtures, WorkerFixtures>({
	dataFixtures: [
		async ({}, use) => {
			ensureFixtures();
			await use();
		},
		{ scope: 'worker', auto: true }
	],
	// Hermetik: permintaan ke luar server uji (mis. wa.me) tidak keluar jaringan; dijawab 200 kosong.
	context: async ({ context }, use) => {
		// Harus sama dengan PROMO_SUPPRESS_KEY di src/lib/promo.ts. Tes promo sendiri yang menghapusnya.
		await context.addInitScript(() => {
			try {
				localStorage.setItem('la_promo_suppress', '1');
			} catch {
				// abaikan
			}
		});
		const own = new URL(BASE_URL).hostname;
		await context.route(
			(url) => url.hostname !== own,
			(route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'eksternal' })
		);
		// Gambar Unsplash (hotlink) dijawab PNG 1x1 yang valid agar tidak memicu galat muat atau cadangan gambar.
		await context.route('https://images.unsplash.com/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX }));
		await use(context);
	},
	allowedConsole: async ({}, use) => {
		await use([]);
	},
	allowConsole: async ({ allowedConsole }, use) => {
		await use((p) => void allowedConsole.push(p));
	},
	// Semua tes gagal bila ada galat konsol/pageerror yang tidak diizinkan.
	page: async ({ page, allowedConsole }, use) => {
		const errors: string[] = [];
		watchConsole(page, errors);
		await use(page);
		const unexpected = errors.filter((e) => ![...ALWAYS_ALLOWED, ...allowedConsole].some((re) => re.test(e)));
		baseExpect(unexpected, 'galat konsol/halaman yang tidak diizinkan').toEqual([]);
	}
});

export const expect = baseExpect;

/** Tunggu hidrasi dokumen saat ini (atribut dipasang aplikasi, lihat src/routes/+layout.svelte). */
export const ready = (page: Page) => expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

export async function gotoReady(page: Page, url: string) {
	await page.goto(url);
	await ready(page);
}

/**
 * Jalankan aksi yang memicu pengiriman form (navigasi penuh), tunggu respons POST, lalu tunggu
 * dokumen BARU berhidrasi. Dokumen lama diberi nilai 'submitting' sehingga tidak bisa dikira
 * dokumen baru (balapan yang menjebak skrip manual dulu).
 */
export async function submit(page: Page, action: () => Promise<unknown>) {
	await page.evaluate(() => {
		document.documentElement.dataset.hydrated = 'submitting';
	});
	const [response] = await Promise.all([
		page.waitForResponse((r) => r.request().method() === 'POST'),
		action()
	]);
	await ready(page);
	return response;
}

export type ShareMode = 'share-ok' | 'abort' | 'not-allowed' | 'cannot' | 'none';

/** Ganti Web Share API dengan stub; jumlah panggilan di `window.__shareCalls`, hasil sukses di `window.__shared`. */
export async function stubShare(context: BrowserContext, mode: ShareMode) {
	await context.addInitScript((m) => {
		const def = (name: string, value: unknown) =>
			Object.defineProperty(Navigator.prototype, name, { value, configurable: true, writable: true });
		if (m === 'none') {
			def('canShare', undefined);
			def('share', undefined);
			return;
		}
		def('canShare', () => m !== 'cannot');
		def('share', async (d: { files: File[]; text: string }) => {
			const w = window as unknown as { __shareCalls?: number };
			w.__shareCalls = (w.__shareCalls ?? 0) + 1;
			if (m === 'abort') throw new DOMException('dibatalkan', 'AbortError');
			if (m === 'not-allowed') throw new DOMException('ditolak', 'NotAllowedError');
			(window as unknown as { __shared: unknown }).__shared = {
				n: d.files.length,
				type: d.files[0].type,
				name: d.files[0].name,
				size: d.files[0].size,
				text: d.text
			};
		});
	}, mode);
}

/** Kumpulkan tab baru yang dibuka halaman (mis. wa.me); permintaannya sudah diblokir oleh fixture `context`. */
export async function capturePopups(context: BrowserContext): Promise<Page[]> {
	const pages: Page[] = [];
	context.on('page', (p) => pages.push(p));
	return pages;
}

/** Isi PDF sebagai string Latin-1 (teks jsPDF tidak terkompresi). */
export async function readPdf(download: Download): Promise<string> {
	return readFileSync(await download.path()).toString('latin1');
}

/**
 * Konteks tambahan (mis. sesi kedua akun yang sama) dengan opsi dan pemblokiran jaringan yang sama
 * seperti konteks bawaan. Konteks dari `browser.newContext()` tidak mewarisi `use` konfigurasi.
 */
export async function openContext(browser: Browser, baseURL: string | undefined, extraHTTPHeaders?: Record<string, string>) {
	const context = await browser.newContext({ baseURL, extraHTTPHeaders, acceptDownloads: true, reducedMotion: 'reduce' });
	const own = new URL(baseURL ?? BASE_URL).hostname;
	await context.route(
		(url) => url.hostname !== own,
		(route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'eksternal' })
	);
	return context;
}

/** Halaman dari konteks tambahan, dengan pengumpul galat konsol yang sama (diperiksa oleh pemanggil). */
export async function openPage(context: BrowserContext) {
	const page = await context.newPage();
	const errors: string[] = [];
	watchConsole(page, errors);
	return { page, errors: () => errors.filter((e) => !ALWAYS_ALLOWED.some((re) => re.test(e))) };
}
