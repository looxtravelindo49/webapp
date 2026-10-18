import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { exec, query, scalar } from './db';
import { DB_PATH } from './env';

/** Folder unggahan server uji: di samping database uji (UPLOAD_DIR tidak diset oleh peluncur). */
export const UPLOAD_DIR = join(dirname(DB_PATH), 'uploads');
export const uploadedFiles = (): string[] => (existsSync(UPLOAD_DIR) ? readdirSync(UPLOAD_DIR).sort() : []);

export type PackageRow = {
	id: number;
	slug: string;
	title: string;
	summary: string;
	body: string;
	includes: string;
	notes: string;
	image: string | null;
	image_alt: string | null;
	duration: string | null;
	price_per_person: number | null;
	min_pax: number;
	published: number;
	sort_order: number;
};
export const pkgByTitle = (title: string) => query<PackageRow>('SELECT * FROM package WHERE title = ?', title)[0];
export const pkgById = (id: number) => query<PackageRow>('SELECT * FROM package WHERE id = ?', id)[0];
export const pkgCount = () => scalar<number>('SELECT COUNT(*) FROM package');

/** Judul unik dengan awalan khusus berkas tes, agar pembersihan hanya menyentuh milik sendiri. */
export const uniqueTitle = (prefix: string) => `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Sisipkan paket langsung ke database (tanpa UI). */
export function insertPackage(title: string, over: Partial<Pick<PackageRow, 'summary' | 'published' | 'price_per_person' | 'min_pax' | 'image' | 'image_alt'>> = {}): PackageRow {
	const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
	const order = scalar<number>('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM package');
	exec(
		`INSERT INTO package (slug, title, summary, body, includes, notes, image, image_alt, duration, price_per_person, min_pax, published, sort_order)
		 VALUES (?, ?, ?, '', '', '', ?, ?, NULL, ?, ?, ?, ?)`,
		slug, title, over.summary ?? 'Ringkasan uji.', over.image ?? null, over.image_alt ?? null,
		over.price_per_person ?? null, over.min_pax ?? 1, over.published ?? 0, order
	);
	return pkgByTitle(title)!;
}

/** Hapus paket uji berawalan `prefix` beserta berkas unggahannya (urutan paket lain tidak disentuh). */
export function cleanupPackages(prefix: string): void {
	for (const p of query<PackageRow>('SELECT * FROM package WHERE title LIKE ?', `${prefix}%`)) {
		if (p.image?.startsWith('/uploads/')) rmSync(join(UPLOAD_DIR, p.image.slice('/uploads/'.length)), { force: true });
		exec('DELETE FROM package WHERE id = ?', p.id);
	}
}

export type FormValues = Partial<{
	title: string;
	summary: string;
	body: string;
	includes: string;
	notes: string;
	duration: string;
	price: string;
	min_pax: string;
	image_alt: string;
}>;

const LABELS: Record<keyof FormValues, string | RegExp> = {
	title: 'Nama paket',
	summary: 'Ringkasan',
	body: /^Penjelasan lengkap/,
	includes: /^Pilihan yang dapat dibahas/,
	notes: /^Catatan/,
	duration: /^Durasi/,
	price: /^Harga per orang/,
	min_pax: 'Minimal peserta',
	image_alt: /^Teks alternatif foto/
};

/** Isi isian form paket yang disebut saja. */
export async function fillPackage(page: Page, values: FormValues) {
	for (const [key, value] of Object.entries(values) as [keyof FormValues, string][]) {
		await page.getByLabel(LABELS[key], { exact: typeof LABELS[key] === 'string' }).fill(value);
	}
}
