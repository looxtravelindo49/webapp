// Peluncur server untuk tes e2e: database baru di test-results/e2e-data, lalu menjalankan build produksi.
// Dijalankan oleh `webServer` di playwright.config.ts setelah `npm run build`.
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const dataDir = resolve(root, 'test-results/e2e-data');
const port = process.env.E2E_PORT || '4180';

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

// Hapus konfigurasi admin dari lingkungan pengembang supaya akun awal BAWAAN yang teruji.
for (const k of ['ADMIN_SEED_LOGIN', 'ADMIN_SEED_PASSWORD', 'ADMIN_RESET_LOGIN', 'ADMIN_RESET_PASSWORD']) delete process.env[k];

Object.assign(process.env, {
	DATABASE_PATH: resolve(dataDir, 'app.db'),
	PORT: port,
	HOST: '127.0.0.1',
	PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
	// Meniru reverse proxy TLS: asal diturunkan dari header ini (klien uji mengirim X-Forwarded-Proto: http).
	PROTOCOL_HEADER: 'x-forwarded-proto',
	// Bawaan adapter-node 512 KB menolak unggahan foto; samakan dengan image kontainer.
	BODY_SIZE_LIMIT: '8M'
});

await import(resolve(root, 'build/index.js'));
