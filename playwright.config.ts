import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || '4180';
const BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
	testDir: './e2e',
	// outputDir dipisah dari test-results/e2e-data agar pembersihan artefak tidak menghapus database uji.
	outputDir: './test-results/artifacts',
	fullyParallel: true,
	forbidOnly: CI,
	retries: CI ? 1 : 0,
	timeout: 30_000,
	expect: { timeout: 7_000 },
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		...devices['Desktop Chrome'],
		baseURL: BASE_URL,
		// Server uji meniru proxy TLS lewat PROTOCOL_HEADER; klien mengirim header yang sama.
		extraHTTPHeaders: { 'X-Forwarded-Proto': 'http' },
		acceptDownloads: true,
		contextOptions: { reducedMotion: 'reduce' },
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		launchOptions: {
			// Chromium sistem bila CHROMIUM_PATH diset; selain itu peramban hasil `npx playwright install chromium`.
			executablePath: process.env.CHROMIUM_PATH || undefined,
			...(process.env.E2E_NO_SANDBOX ? { chromiumSandbox: false } : {})
		}
	},
	projects: [
		// Tes yang tidak mengubah data bersama; berjalan paralel antar file.
		{ name: 'main', testIgnore: '**/mutating/**' },
		// Tes yang sementara mengubah data bersama (paket terbit, urutan, harga, nomor WhatsApp): berjalan SETELAH
		// proyek utama selesai dan memulihkan data di afterAll. Setiap file mutating mendapat proyek sendiri yang
		// berantai (dependencies) agar tidak pernah berjalan bersamaan di worker berbeda.
		{ name: 'mutating', testMatch: '**/mutating/data.spec.ts', dependencies: ['main'] },
		{ name: 'mutating-cms', testMatch: '**/mutating/cms.spec.ts', dependencies: ['mutating'] },
		{ name: 'mutating-articles', testMatch: '**/mutating/articles.spec.ts', dependencies: ['mutating-cms'] }
	],
	// Pakai server yang sudah berjalan bila E2E_BASE_URL diset (lihat README).
	webServer: process.env.E2E_BASE_URL
		? undefined
		: {
				command: 'npm run build && node e2e/support/start-server.mjs',
				url: `${BASE_URL}/healthz`,
				reuseExistingServer: false,
				timeout: 180_000,
				stdout: 'ignore',
				stderr: 'pipe'
			}
});
