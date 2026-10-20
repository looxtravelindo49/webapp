import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import PackageGalleryManager from './PackageGalleryManager.svelte';

const photo = (id: number, alt: string | null = null) => ({ id, path: '/media/forest.svg', alt });
const html = (photos: { id: number; path: string; alt: string | null }[], error = '') =>
	render(PackageGalleryManager, { props: { photos, error } }).body;

describe('PackageGalleryManager', () => {
	it('menampilkan isian unggah dengan label yang tetap', () => {
		const body = html([]);
		expect(body).toContain('Tambah foto galeri');
		expect(body).toContain('name="gallery_photo"');
		expect(body).toContain('Teks alternatif foto galeri');
		expect(body).toContain('name="gallery_alt"');
		expect(body).toContain('Unggah ke galeri');
		expect(body).toContain('action="?/unggah"');
		expect(body).not.toContain('Hapus foto ini');
	});

	it('menyembunyikan unggah saat sudah 4 foto dan menampilkan tombol kelola', () => {
		const body = html([photo(1, 'Pinus'), photo(2), photo(3), photo(4)]);
		expect(body).not.toContain('Tambah foto galeri');
		expect(body).not.toContain('Unggah ke galeri');
		expect(body).toContain('Galeri penuh (4 foto)');
		expect(body).toContain('Teks alternatif foto 1');
		expect(body).toContain('Teks alternatif foto 4');
		expect(body).toContain('value="Pinus"');
		expect(body).toContain('Simpan teks alternatif');
		expect(body).toContain('>Naik<');
		expect(body).toContain('>Turun<');
		expect(body).toContain('Hapus dari galeri');
		expect(body).toContain('action="?/hapusGaleri"');
		expect(body).not.toContain('>Hapus<');
	});

	it('menampilkan kesalahan galeri', () => {
		expect(html([], 'Galeri sudah penuh. Maksimal 4 foto.')).toContain('Galeri sudah penuh. Maksimal 4 foto.');
	});
});
