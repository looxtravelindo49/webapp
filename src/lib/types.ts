/** Paket sebagaimana dikirim ke browser (tipe bersama server dan komponen). */
export type Package = {
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
	/** Rupiah utuh per orang; null berarti "harga menyusul". */
	price_per_person: number | null;
	min_pax: number;
	/**
	 * `per_person`: harga × max(peserta, min_pax).
	 * `per_unit`: pembulatan ke atas per satuan (mobil, dll.). Kosong = per orang.
	 */
	pricing_mode?: 'per_person' | 'per_unit';
	/** Kapasitas satu satuan. Dipakai hanya bila `pricing_mode` = `per_unit`. */
	kapasitas_per_unit?: number | null;
	/** Nama satuan yang tampil di rincian, misalnya "mobil". */
	nama_unit?: string | null;
	published: number;
	sort_order: number;
	/** Foto galeri pertama, bila ada. Kartu katalog memakai ini; tab paket tetap memakai `image`. */
	cover_image?: string | null;
	cover_alt?: string | null;
};

/** Artikel lengkap (halaman artikel dan CMS). */
export type Article = {
	id: number;
	slug: string;
	title: string;
	category: string;
	excerpt: string;
	body: string;
	cover_image: string | null;
	cover_alt: string | null;
	/** Kredit foto Unsplash; ketiganya terisi bersama bila sampul berasal dari Unsplash. */
	cover_credit_name: string | null;
	cover_credit_url: string | null;
	cover_unsplash_id: string | null;
	published: number;
	featured: number;
	published_at: string | null;
	created_at: string;
	updated_at: string;
};

/** Artikel untuk kartu dan daftar: tanpa isi. */
export type ArticleSummary = Omit<Article, 'body'>;
